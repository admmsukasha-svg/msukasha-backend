const express = require('express');
const router  = express.Router();
const Product = require('../models/Product');
const { protect, adminOnly } = require('../middleware/auth');
const { sellerProtect }      = require('../middleware/sellerAuth');

// GET /api/products — Sab products (public, with filters)
router.get('/', async (req, res) => {
  try {
    const {
      category, search, minPrice, maxPrice,
      sort = '-createdAt', page = 1, limit = 20,
      seller, featured
    } = req.query;

    const filter = { status: 'active' };

    if (category)  filter.category = category;
    if (seller)    filter.seller   = seller;
    if (featured)  filter.isFeatured = true;

    if (minPrice || maxPrice) {
      filter.price = {};
      if (minPrice) filter.price.$gte = Number(minPrice);
      if (maxPrice) filter.price.$lte = Number(maxPrice);
    }

    if (search) {
      filter.$text = { $search: search };
    }

    const skip = (Number(page) - 1) * Number(limit);

    const [products, total] = await Promise.all([
      Product.find(filter)
        .populate('seller', 'businessName logo rating city')
        .sort(sort)
        .skip(skip)
        .limit(Number(limit))
        .lean(),
      Product.countDocuments(filter)
    ]);

    res.json({
      success: true,
      total,
      page:       Number(page),
      totalPages: Math.ceil(total / Number(limit)),
      products
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/products/featured — Featured products
router.get('/featured', async (req, res) => {
  try {
    const products = await Product.find({ status: 'active', isFeatured: true })
      .populate('seller', 'businessName logo')
      .limit(12)
      .lean();
    res.json({ success: true, products });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/products/categories — Category list
router.get('/categories', (req, res) => {
  const categories = [
    'electronics', 'clothing', 'footwear', 'home_appliances',
    'furniture', 'groceries', 'beauty', 'sports', 'books',
    'toys', 'automotive', 'agriculture', 'other'
  ];
  res.json({ success: true, categories });
});

// GET /api/products/:id — Single product
router.get('/:id', async (req, res) => {
  try {
    const product = await Product.findById(req.params.id)
      .populate('seller', 'businessName logo rating totalReviews address phone');

    if (!product || product.status === 'inactive') {
      return res.status(404).json({ success: false, message: 'Product nahi mila' });
    }

    // Views increase karo
    await Product.findByIdAndUpdate(req.params.id, { $inc: { views: 1 } });

    res.json({ success: true, product });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─────────────────────────────────────────────
//  SELLER: apne products manage karo
// ─────────────────────────────────────────────

// GET /api/products/seller/my — Seller ke products
router.get('/seller/my', sellerProtect, async (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const filter = { seller: req.seller._id };
    if (status) filter.status = status;

    const [products, total] = await Promise.all([
      Product.find(filter).sort('-createdAt').skip((page - 1) * limit).limit(Number(limit)).lean(),
      Product.countDocuments(filter)
    ]);

    res.json({ success: true, total, products });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/products/seller/add — Naya product
router.post('/seller/add', sellerProtect, async (req, res) => {
  try {
    const {
      name, description, category, subcategory,
      price, salePrice, stock, unit, minOrderQty,
      brand, tags, specifications, images
    } = req.body;

    if (!name || !description || !category || price === undefined || stock === undefined) {
      return res.status(400).json({ success: false, message: 'Name, description, category, price aur stock required hain' });
    }

    const product = await Product.create({
      seller: req.seller._id,
      name, description, category, subcategory,
      price, salePrice, stock, unit, minOrderQty,
      brand, tags, specifications,
      images: images || [],
      status: 'pending_review'
    });

    // Seller ka product count update karo
    const Seller = require('../models/Seller');
    await Seller.findByIdAndUpdate(req.seller._id, { $inc: { totalProducts: 1 } });

    res.status(201).json({ success: true, message: 'Product add ho gaya, admin review ke baad live hoga', product });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PUT /api/products/seller/:id — Product update
router.put('/seller/:id', sellerProtect, async (req, res) => {
  try {
    const product = await Product.findOne({ _id: req.params.id, seller: req.seller._id });
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product nahi mila ya aapka nahi hai' });
    }

    const allowed = ['name', 'description', 'category', 'subcategory', 'price', 'salePrice',
                     'stock', 'unit', 'minOrderQty', 'brand', 'tags', 'specifications', 'images', 'status'];
    allowed.forEach(field => {
      if (req.body[field] !== undefined) product[field] = req.body[field];
    });

    // Update ke baad pending review mein wapis
    if (req.body.name || req.body.description || req.body.price) {
      product.status = 'pending_review';
    }

    await product.save();
    res.json({ success: true, message: 'Product update ho gaya', product });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// DELETE /api/products/seller/:id — Product delete
router.delete('/seller/:id', sellerProtect, async (req, res) => {
  try {
    const product = await Product.findOneAndDelete({ _id: req.params.id, seller: req.seller._id });
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product nahi mila ya aapka nahi hai' });
    }
    res.json({ success: true, message: 'Product delete ho gaya' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─────────────────────────────────────────────
//  ADMIN: product approve/reject
// ─────────────────────────────────────────────

// GET /api/products/admin/pending — Pending products
router.get('/admin/pending', protect, adminOnly, async (req, res) => {
  try {
    const products = await Product.find({ status: 'pending_review' })
      .populate('seller', 'businessName email')
      .sort('createdAt').lean();
    res.json({ success: true, products });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PUT /api/products/admin/:id/status — Status change
router.put('/admin/:id/status', protect, adminOnly, async (req, res) => {
  try {
    const { status } = req.body;
    const validStatuses = ['active', 'inactive', 'pending_review', 'out_of_stock'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status' });
    }

    const product = await Product.findByIdAndUpdate(req.params.id, { status }, { new: true });
    if (!product) return res.status(404).json({ success: false, message: 'Product nahi mila' });

    res.json({ success: true, message: `Product ${status} kar diya gaya`, product });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PUT /api/products/admin/:id/featured — Featured toggle
router.put('/admin/:id/featured', protect, adminOnly, async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ success: false, message: 'Product nahi mila' });
    product.isFeatured = !product.isFeatured;
    await product.save();
    res.json({ success: true, message: `Featured: ${product.isFeatured}`, product });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
