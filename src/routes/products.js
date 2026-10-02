const express = require('express');
const Product = require('../models/Product');
const { requireAuth, requireRole } = require('../middleware/auth');
const {
  asyncHandler, HttpError, cleanText, cleanImage, escapeRegex, clampInt, isObjectId
} = require('../utils/helpers');

const router = express.Router();

function buildProduct(b, partial) {
  const out = {};
  const name = b.name !== undefined ? b.name : b.title;
  if (name !== undefined || !partial) {
    out.name = cleanText(name, 200);
    if (!out.name) throw new HttpError(400, 'Product name is required.');
  }
  if (b.price !== undefined || !partial) {
    const price = Number(b.price);
    if (!Number.isFinite(price) || price < 0) throw new HttpError(400, 'Enter a valid price.');
    out.price = price;
  }
  if (b.short !== undefined) out.short = cleanText(b.short, 100);
  if (b.description !== undefined) out.description = cleanText(b.description, 5000);
  if (b.type !== undefined) {
    if (!['b2b', 'c2c'].includes(b.type)) throw new HttpError(400, 'Type must be b2b or c2c.');
    out.type = b.type;
  }
  const cat = b.cat !== undefined ? b.cat : b.category;
  if (cat !== undefined) out.cat = cleanText(cat, 50);
  if (b.unit !== undefined) out.unit = cleanText(b.unit, 20) || 'pc';
  const moq = b.moq !== undefined ? b.moq : b.minOrder;
  if (moq !== undefined) out.moq = clampInt(moq, 1, 1000000, 1);
  if (b.stock !== undefined) out.stock = clampInt(b.stock, 0, 100000000, 0);
  if (b.location !== undefined) out.location = cleanText(b.location, 120);
  if (b.img !== undefined) out.img = cleanImage(b.img);
  if (b.fallback !== undefined) out.fallback = cleanImage(b.fallback);
  if (b.images !== undefined) {
    if (!Array.isArray(b.images)) throw new HttpError(400, 'images must be a list.');
    out.images = b.images.slice(0, 10).map(cleanImage).filter(Boolean);
  }
  if (b.status !== undefined) {
    if (!['active', 'inactive'].includes(b.status)) throw new HttpError(400, 'Invalid status.');
    out.status = b.status;
  }
  return out;
}

async function ownedProduct(req) {
  if (!isObjectId(req.params.id)) throw new HttpError(404, 'Product not found.');
  const product = await Product.findById(req.params.id);
  if (!product) throw new HttpError(404, 'Product not found.');
  if (String(product.seller) !== String(req.user._id) && req.user.role !== 'admin') {
    throw new HttpError(403, 'This is not your product.');
  }
  return product;
}

// GET /api/products   (public)
router.get('/', asyncHandler(async (req, res) => {
  const q = { status: 'active' };
  const f = req.query;
  if (['b2b', 'c2c'].includes(f.type)) q.type = f.type;
  if (f.cat) q.cat = String(f.cat).slice(0, 50);
  if (f.seller && isObjectId(String(f.seller))) q.seller = String(f.seller);
  if (f.q) {
    const rx = new RegExp(escapeRegex(String(f.q).slice(0, 80)), 'i');
    q.$or = [{ name: rx }, { short: rx }, { description: rx }];
  }
  const min = Number(f.minPrice), max = Number(f.maxPrice);
  if (Number.isFinite(min) || Number.isFinite(max)) {
    q.price = {};
    if (Number.isFinite(min)) q.price.$gte = min;
    if (Number.isFinite(max)) q.price.$lte = max;
  }
  const page = clampInt(f.page, 1, 10000, 1);
  const limit = clampInt(f.limit, 1, 100, 24);

  const [products, total] = await Promise.all([
    Product.find(q).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit)
      .populate('seller', 'name companyName city'),
    Product.countDocuments(q)
  ]);
  res.json({ products, total, page, pages: Math.ceil(total / limit) });
}));

// GET /api/products/my   (before /:id)
router.get('/my', requireAuth, asyncHandler(async (req, res) => {
  const products = await Product.find({ seller: req.user._id }).sort({ createdAt: -1 }).limit(500);
  res.json({ products });
}));

// GET /api/products/:id
router.get('/:id', asyncHandler(async (req, res) => {
  if (!isObjectId(req.params.id)) throw new HttpError(404, 'Product not found.');
  const product = await Product.findOne({ _id: req.params.id, status: 'active' })
    .populate('seller', 'name companyName city');
  if (!product) throw new HttpError(404, 'Product not found.');
  res.json({ product });
}));

// POST /api/products   (seller)
router.post('/', requireAuth, requireRole('seller', 'admin'), asyncHandler(async (req, res) => {
  const product = await Product.create({ ...buildProduct(req.body || {}, false), seller: req.user._id });
  res.status(201).json({ product });
}));

// PUT /api/products/:id
router.put('/:id', requireAuth, asyncHandler(async (req, res) => {
  const product = await ownedProduct(req);
  product.set(buildProduct(req.body || {}, true));
  await product.save();
  res.json({ product });
}));

// DELETE /api/products/:id
router.delete('/:id', requireAuth, asyncHandler(async (req, res) => {
  const product = await ownedProduct(req);
  await product.deleteOne();
  res.json({ message: 'Product deleted.' });
}));

module.exports = router;
