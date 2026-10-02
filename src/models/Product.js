const mongoose = require('mongoose');
const applyJSON = require('./_json');

// Field names follow the MS_PRODUCTS catalog in main.js.
const schema = new mongoose.Schema({
  seller: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  name: { type: String, required: true, trim: true, maxlength: 200 },
  short: { type: String, default: '', maxlength: 100 },
  description: { type: String, default: '', maxlength: 5000 },
  type: { type: String, enum: ['b2b', 'c2c'], default: 'b2b' },
  cat: { type: String, default: '', maxlength: 50 },
  price: { type: Number, required: true, min: 0 },
  unit: { type: String, default: 'pc', maxlength: 20 },
  moq: { type: Number, default: 1, min: 1 },
  stock: { type: Number, default: 0, min: 0 },
  location: { type: String, default: '', maxlength: 120 },
  img: { type: String, default: '' },
  fallback: { type: String, default: '' },
  images: { type: [String], default: [] },
  status: { type: String, enum: ['active', 'inactive'], default: 'active' }
}, { timestamps: true });

schema.index({ status: 1, type: 1, cat: 1, createdAt: -1 });
applyJSON(schema);
module.exports = mongoose.models.Product || mongoose.model('Product', schema);
