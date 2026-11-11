const express = require('express');
const Product = require('../models/Product');
const User = require('../models/User');
const { requireAuth, requireRole } = require('../middleware/auth');
const {
  asyncHandler, HttpError, cleanText, cleanImage, escapeRegex, clampInt, isObjectId
} = require('../utils/helpers');

const router = express.Router();
const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

function publicProduct(product) {
  const result = product.toJSON();
  if (product.hasUploadedImage) result.img = `/api/products/${result.id}/image?v=${product.updatedAt.getTime()}`;
  return result;
}

function validImageContent(buffer, contentType) {
  if (contentType === 'image/jpeg') {
    return buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  }
  if (contentType === 'image/png') {
    return buffer.length >= 8
      && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  }
  if (contentType === 'image/webp') {
    return buffer.length >= 12
      && buffer.toString('ascii', 0, 4) === 'RIFF'
      && buffer.toString('ascii', 8, 12) === 'WEBP';
  }
  return false;
}

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

  const [productDocs, total] = await Promise.all([
    Product.find(q).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit)
      .populate('seller', 'name companyName city'),
    Product.countDocuments(q)
  ]);
  const products = productDocs.map((product) => {
    const data = publicProduct(product);
    if (product.seller) data.seller = product.seller.toJSON();
    return data;
  });
  res.json({ products, total, page, pages: Math.ceil(total / limit) });
}));

// GET /api/products/my   (before /:id)
router.get('/my', requireAuth, asyncHandler(async (req, res) => {
  const products = await Product.find({ seller: req.user._id }).sort({ createdAt: -1 }).limit(500);
  res.json({ products: products.map(publicProduct) });
}));

// GET /api/products/store/:sellerId (public seller storefront)
router.get('/store/:sellerId', asyncHandler(async (req, res) => {
  if (!isObjectId(req.params.sellerId)) throw new HttpError(404, 'Store not found.');
  const seller = await User.findOne({
    _id: req.params.sellerId,
    role: { $in: ['seller', 'admin'] },
    isActive: true
  }).select('name companyName city profile.about');
  if (!seller) throw new HttpError(404, 'Store not found.');

  const products = await Product.find({ seller: seller._id, status: 'active' })
    .sort({ createdAt: -1 })
    .limit(500);
  res.json({
    store: {
      id: String(seller._id),
      name: seller.companyName || seller.name,
      ownerName: seller.name,
      city: seller.city,
      about: seller.profile && seller.profile.about || ''
    },
    products: products.map(publicProduct)
  });
}));

// GET /api/products/:id/image (published product images are public)
router.get('/:id/image', asyncHandler(async (req, res) => {
  if (!isObjectId(req.params.id)) throw new HttpError(404, 'Product image not found.');
  const product = await Product.findById(req.params.id)
    .select('+uploadedImage +uploadedImageType');
  if (!product || !product.uploadedImage) throw new HttpError(404, 'Product image not found.');
  res.set('Cache-Control', 'public, max-age=86400');
  res.type(product.uploadedImageType);
  res.send(product.uploadedImage);
}));

// PUT /api/products/:id/image (seller-owned image upload; max 2 MB)
router.put('/:id/image', requireAuth, requireRole('seller', 'admin'),
  express.raw({ type: Array.from(IMAGE_TYPES), limit: '2mb' }),
  asyncHandler(async (req, res) => {
    const product = await ownedProduct(req);
    const contentType = String(req.headers['content-type'] || '').split(';')[0].trim().toLowerCase();
    if (!IMAGE_TYPES.has(contentType) || !Buffer.isBuffer(req.body) || !validImageContent(req.body, contentType)) {
      throw new HttpError(400, 'Upload a JPEG, PNG, or WebP product photo.');
    }

    product.uploadedImage = req.body;
    product.uploadedImageType = contentType;
    product.hasUploadedImage = true;
    await product.save();
    res.json({ product: publicProduct(product) });
  }));

// GET /api/products/:id
router.get('/:id', asyncHandler(async (req, res) => {
  if (!isObjectId(req.params.id)) throw new HttpError(404, 'Product not found.');
  const product = await Product.findOne({ _id: req.params.id, status: 'active' })
    .populate('seller', 'name companyName city');
  if (!product) throw new HttpError(404, 'Product not found.');
  const result = publicProduct(product);
  if (product.seller) result.seller = product.seller.toJSON();
  res.json({ product: result });
}));

// POST /api/products   (seller)
router.post('/', requireAuth, requireRole('seller', 'admin'), asyncHandler(async (req, res) => {
  const product = await Product.create({ ...buildProduct(req.body || {}, false), seller: req.user._id });
  res.status(201).json({ product });
}));

// PUT /api/products/:id
router.put('/:id', requireAuth, requireRole('seller', 'admin'), asyncHandler(async (req, res) => {
  const product = await ownedProduct(req);
  const input = buildProduct(req.body || {}, true);
  if (input.img && product.hasUploadedImage) {
    product.hasUploadedImage = false;
    product.uploadedImage = undefined;
    product.uploadedImageType = undefined;
  }
  product.set(input);
  await product.save();
  res.json({ product });
}));

// DELETE /api/products/:id
router.delete('/:id', requireAuth, requireRole('seller', 'admin'), asyncHandler(async (req, res) => {
  const product = await ownedProduct(req);
  await product.deleteOne();
  res.json({ message: 'Product deleted.' });
}));

module.exports = router;
