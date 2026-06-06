const express = require('express');
const router  = express.Router();
const Order   = require('../models/Order');
const Product = require('../models/Product');
const Cart    = require('../models/Cart');
const { protect, adminOnly } = require('../middleware/auth');
const { sellerProtect }      = require('../middleware/sellerAuth');

// ─────────────────────────────────────────────
//  BUYER: Orders
// ─────────────────────────────────────────────

// POST /api/orders — Order place karo
router.post('/', protect, async (req, res) => {
  try {
    const { items, shippingAddress, paymentMethod, notes } = req.body;

    if (!items || !items.length) {
      return res.status(400).json({ success: false, message: 'Cart mein kuch toh hona chahiye' });
    }
    if (!shippingAddress || !paymentMethod) {
      return res.status(400).json({ success: false, message: 'Shipping address aur payment method zaroor dein' });
    }

    // Products validate karo aur price calculate karo
    let subtotal = 0;
    const orderItems = [];

    for (const item of items) {
      const product = await Product.findById(item.product).populate('seller', '_id');
      if (!product || product.status !== 'active') {
        return res.status(400).json({ success: false, message: `Product "${item.product}" available nahi hai` });
      }
      if (product.stock < item.qty) {
        return res.status(400).json({ success: false, message: `"${product.name}" ka stock sirf ${product.stock} hai` });
      }

      const price    = product.salePrice || product.price;
      const itemTotal = price * item.qty;
      subtotal       += itemTotal;

      orderItems.push({
        product:  product._id,
        seller:   product.seller._id,
        name:     product.name,
        image:    product.images[0] || '',
        price,
        qty:      item.qty,
        subtotal: itemTotal
      });
    }

    const shippingCost = subtotal >= 2000 ? 0 : 150; // Free shipping above PKR 2000
    const totalAmount  = subtotal + shippingCost;

    const order = await Order.create({
      buyer:          req.user._id,
      items:          orderItems,
      shippingAddress,
      paymentMethod,
      paymentStatus:  paymentMethod === 'cod' ? 'pending' : 'pending',
      subtotal,
      shippingCost,
      totalAmount,
      notes: notes || '',
      statusHistory: [{ status: 'placed', note: 'Order place ho gaya' }]
    });

    // Stock kam karo
    for (const item of orderItems) {
      await Product.findByIdAndUpdate(item.product, {
        $inc: { stock: -item.qty, totalSold: item.qty }
      });
    }

    // Cart clear karo
    await Cart.findOneAndUpdate({ buyer: req.user._id }, { items: [] });

    res.status(201).json({
      success: true,
      message: 'Order place ho gaya!',
      order: {
        _id:         order._id,
        orderNumber: order.orderNumber,
        totalAmount: order.totalAmount,
        status:      order.orderStatus
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/orders/my — Buyer ke apne orders
router.get('/my', protect, async (req, res) => {
  try {
    const { page = 1, limit = 10, status } = req.query;
    const filter = { buyer: req.user._id };
    if (status) filter.orderStatus = status;

    const [orders, total] = await Promise.all([
      Order.find(filter)
        .populate('items.product', 'name images')
        .sort('-createdAt')
        .skip((page - 1) * limit)
        .limit(Number(limit))
        .lean(),
      Order.countDocuments(filter)
    ]);

    res.json({ success: true, total, orders });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/orders/my/:id — Single order detail
router.get('/my/:id', protect, async (req, res) => {
  try {
    const order = await Order.findOne({ _id: req.params.id, buyer: req.user._id })
      .populate('items.product', 'name images price')
      .populate('items.seller', 'businessName phone');

    if (!order) return res.status(404).json({ success: false, message: 'Order nahi mila' });

    res.json({ success: true, order });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PUT /api/orders/my/:id/cancel — Order cancel
router.put('/my/:id/cancel', protect, async (req, res) => {
  try {
    const order = await Order.findOne({ _id: req.params.id, buyer: req.user._id });
    if (!order) return res.status(404).json({ success: false, message: 'Order nahi mila' });

    if (!['placed', 'confirmed'].includes(order.orderStatus)) {
      return res.status(400).json({ success: false, message: 'Yeh order ab cancel nahi ho sakta' });
    }

    order.orderStatus = 'cancelled';
    order.statusHistory.push({ status: 'cancelled', note: req.body.reason || 'Buyer ne cancel kiya' });
    await order.save();

    // Stock wapis karo
    for (const item of order.items) {
      await Product.findByIdAndUpdate(item.product, {
        $inc: { stock: item.qty, totalSold: -item.qty }
      });
    }

    res.json({ success: true, message: 'Order cancel ho gaya' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─────────────────────────────────────────────
//  SELLER: Orders manage
// ─────────────────────────────────────────────

// GET /api/orders/seller — Seller ke orders
router.get('/seller', sellerProtect, async (req, res) => {
  try {
    const { page = 1, limit = 20, status } = req.query;
    const filter = { 'items.seller': req.seller._id };
    if (status) filter.orderStatus = status;

    const [orders, total] = await Promise.all([
      Order.find(filter)
        .populate('buyer', 'name email phone')
        .sort('-createdAt')
        .skip((page - 1) * limit)
        .limit(Number(limit))
        .lean(),
      Order.countDocuments(filter)
    ]);

    res.json({ success: true, total, orders });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/orders/seller/stats — Seller sales stats
router.get('/seller/stats', sellerProtect, async (req, res) => {
  try {
    const sellerId = req.seller._id;

    const [totalOrders, delivered, pending, revenue] = await Promise.all([
      Order.countDocuments({ 'items.seller': sellerId }),
      Order.countDocuments({ 'items.seller': sellerId, orderStatus: 'delivered' }),
      Order.countDocuments({ 'items.seller': sellerId, orderStatus: { $in: ['placed', 'confirmed', 'processing'] } }),
      Order.aggregate([
        { $match: { 'items.seller': sellerId, orderStatus: 'delivered' } },
        { $unwind: '$items' },
        { $match: { 'items.seller': sellerId } },
        { $group: { _id: null, total: { $sum: '$items.subtotal' } } }
      ])
    ]);

    res.json({
      success: true,
      stats: {
        totalOrders,
        delivered,
        pending,
        totalRevenue: revenue[0]?.total || 0
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PUT /api/orders/seller/:id/status — Order status update
router.put('/seller/:id/status', sellerProtect, async (req, res) => {
  try {
    const { status, note, trackingNumber } = req.body;
    const validStatuses = ['confirmed', 'processing', 'shipped', 'delivered'];

    if (!validStatuses.includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status' });
    }

    const order = await Order.findOne({ _id: req.params.id, 'items.seller': req.seller._id });
    if (!order) return res.status(404).json({ success: false, message: 'Order nahi mila' });

    order.orderStatus = status;
    if (trackingNumber) order.trackingNumber = trackingNumber;
    order.statusHistory.push({ status, note: note || '' });

    if (status === 'delivered') {
      order.paymentStatus = 'paid';
    }

    await order.save();
    res.json({ success: true, message: `Order ${status} ho gaya`, order });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─────────────────────────────────────────────
//  ADMIN: All orders
// ─────────────────────────────────────────────

// GET /api/orders/admin/all — Admin sab orders dekhe
router.get('/admin/all', protect, adminOnly, async (req, res) => {
  try {
    const { page = 1, limit = 30, status, paymentStatus } = req.query;
    const filter = {};
    if (status)        filter.orderStatus   = status;
    if (paymentStatus) filter.paymentStatus = paymentStatus;

    const [orders, total] = await Promise.all([
      Order.find(filter)
        .populate('buyer', 'name email')
        .sort('-createdAt')
        .skip((page - 1) * limit)
        .limit(Number(limit))
        .lean(),
      Order.countDocuments(filter)
    ]);

    res.json({ success: true, total, orders });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
