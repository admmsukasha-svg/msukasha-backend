const express = require('express');
const router  = express.Router();
const Review  = require('../models/Review');
const Product = require('../models/Product');
const Order   = require('../models/Order');
const { protect } = require('../middleware/auth');

// GET /api/reviews/:productId — Product ke reviews
router.get('/:productId', async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;

    const [reviews, total] = await Promise.all([
      Review.find({ product: req.params.productId })
        .populate('buyer', 'name avatar')
        .sort('-createdAt')
        .skip((page - 1) * limit)
        .limit(Number(limit))
        .lean(),
      Review.countDocuments({ product: req.params.productId })
    ]);

    // Average rating
    const avgResult = await Review.aggregate([
      { $match: { product: require('mongoose').Types.ObjectId(req.params.productId) } },
      { $group: { _id: null, avgRating: { $avg: '$rating' }, count: { $sum: 1 } } }
    ]);

    res.json({
      success: true,
      total,
      avgRating: avgResult[0]?.avgRating?.toFixed(1) || 0,
      reviews
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/reviews/:productId — Review likhna
router.post('/:productId', protect, async (req, res) => {
  try {
    const { rating, title, comment, images } = req.body;

    if (!rating) {
      return res.status(400).json({ success: false, message: 'Rating dena zaroori hai' });
    }

    // Check karo kya pehle se review hai
    const existing = await Review.findOne({ product: req.params.productId, buyer: req.user._id });
    if (existing) {
      return res.status(400).json({ success: false, message: 'Aap pehle hi review de chuke hain' });
    }

    // Verify purchase
    const order = await Order.findOne({
      buyer: req.user._id,
      'items.product': req.params.productId,
      orderStatus: 'delivered'
    });

    const review = await Review.create({
      product: req.params.productId,
      buyer:   req.user._id,
      order:   order?._id,
      rating,
      title,
      comment,
      images: images || [],
      isVerifiedPurchase: !!order
    });

    // Product rating update karo
    const stats = await Review.aggregate([
      { $match: { product: require('mongoose').Types.ObjectId(req.params.productId) } },
      { $group: { _id: null, avgRating: { $avg: '$rating' }, count: { $sum: 1 } } }
    ]);

    await Product.findByIdAndUpdate(req.params.productId, {
      rating:       parseFloat(stats[0]?.avgRating?.toFixed(1)) || 0,
      totalReviews: stats[0]?.count || 0
    });

    await review.populate('buyer', 'name avatar');
    res.status(201).json({ success: true, message: 'Review submit ho gaya!', review });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PUT /api/reviews/:id — Review edit karo
router.put('/:id', protect, async (req, res) => {
  try {
    const review = await Review.findOne({ _id: req.params.id, buyer: req.user._id });
    if (!review) return res.status(404).json({ success: false, message: 'Review nahi mili' });

    const { rating, title, comment } = req.body;
    if (rating) review.rating  = rating;
    if (title)  review.title   = title;
    if (comment) review.comment = comment;
    await review.save();

    res.json({ success: true, message: 'Review update ho gayi', review });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// DELETE /api/reviews/:id — Review delete
router.delete('/:id', protect, async (req, res) => {
  try {
    const review = await Review.findOne({ _id: req.params.id, buyer: req.user._id });
    if (!review) return res.status(404).json({ success: false, message: 'Review nahi mili' });

    await review.deleteOne();
    res.json({ success: true, message: 'Review delete ho gayi' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
