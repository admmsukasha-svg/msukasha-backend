const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  seller: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Seller',
    required: true
  },
  name: {
    type: String,
    required: [true, 'Product name is required'],
    trim: true,
    maxlength: 200
  },
  slug: {
    type: String,
    unique: true,
    lowercase: true
  },
  description: {
    type: String,
    required: [true, 'Description is required']
  },
  category: {
    type: String,
    required: [true, 'Category is required'],
    enum: [
      'electronics', 'clothing', 'footwear', 'home_appliances',
      'furniture', 'groceries', 'beauty', 'sports', 'books',
      'toys', 'automotive', 'agriculture', 'other'
    ]
  },
  subcategory: {
    type: String,
    default: ''
  },
  images: [{
    type: String
  }],
  price: {
    type: Number,
    required: [true, 'Price is required'],
    min: 0
  },
  salePrice: {
    type: Number,
    default: null
  },
  currency: {
    type: String,
    default: 'PKR'
  },
  stock: {
    type: Number,
    required: true,
    min: 0,
    default: 0
  },
  unit: {
    type: String,
    default: 'piece'
  },
  minOrderQty: {
    type: Number,
    default: 1
  },
  brand: {
    type: String,
    default: ''
  },
  tags: [String],
  specifications: [{
    key:   { type: String },
    value: { type: String }
  }],
  status: {
    type: String,
    enum: ['active', 'inactive', 'out_of_stock', 'pending_review'],
    default: 'pending_review'
  },
  isFeatured: {
    type: Boolean,
    default: false
  },
  // Stats
  views:        { type: Number, default: 0 },
  totalSold:    { type: Number, default: 0 },
  rating:       { type: Number, default: 0, min: 0, max: 5 },
  totalReviews: { type: Number, default: 0 }
}, { timestamps: true });

// Auto-generate slug from name
productSchema.pre('save', function (next) {
  if (this.isModified('name')) {
    this.slug = this.name
      .toLowerCase()
      .replace(/[^a-z0-9 ]/g, '')
      .replace(/\s+/g, '-') + '-' + Date.now();
  }
  next();
});

// Text search index
productSchema.index({ name: 'text', description: 'text', tags: 'text' });
productSchema.index({ category: 1, status: 1 });
productSchema.index({ seller: 1 });
productSchema.index({ price: 1 });

module.exports = mongoose.model('Product', productSchema);
