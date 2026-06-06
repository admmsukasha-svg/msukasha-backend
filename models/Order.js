const mongoose = require('mongoose');

const orderItemSchema = new mongoose.Schema({
  product:  { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  seller:   { type: mongoose.Schema.Types.ObjectId, ref: 'Seller',  required: true },
  name:     { type: String, required: true },
  image:    { type: String, default: '' },
  price:    { type: Number, required: true },
  qty:      { type: Number, required: true, min: 1 },
  subtotal: { type: Number, required: true }
}, { _id: false });

const orderSchema = new mongoose.Schema({
  orderNumber: {
    type: String,
    unique: true
  },
  buyer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  items: [orderItemSchema],
  shippingAddress: {
    name:     { type: String, required: true },
    phone:    { type: String, required: true },
    street:   { type: String, required: true },
    city:     { type: String, required: true },
    province: { type: String, required: true },
    zip:      { type: String, default: '' }
  },
  paymentMethod: {
    type: String,
    enum: ['cod', 'jazzcash', 'easypaisa', 'bank_transfer', 'card'],
    required: true
  },
  paymentStatus: {
    type: String,
    enum: ['pending', 'paid', 'failed', 'refunded'],
    default: 'pending'
  },
  orderStatus: {
    type: String,
    enum: ['placed', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'returned'],
    default: 'placed'
  },
  subtotal:      { type: Number, required: true },
  shippingCost:  { type: Number, default: 0 },
  discount:      { type: Number, default: 0 },
  totalAmount:   { type: Number, required: true },
  currency:      { type: String, default: 'PKR' },
  notes:         { type: String, default: '' },
  trackingNumber: { type: String, default: '' },
  statusHistory: [{
    status:    String,
    note:      String,
    updatedAt: { type: Date, default: Date.now }
  }]
}, { timestamps: true });

// Auto order number generate karo
orderSchema.pre('save', function (next) {
  if (!this.orderNumber) {
    this.orderNumber = 'MSK-' + Date.now() + '-' + Math.floor(Math.random() * 1000);
  }
  next();
});

orderSchema.index({ buyer: 1, createdAt: -1 });
orderSchema.index({ orderNumber: 1 });
orderSchema.index({ 'items.seller': 1 });

module.exports = mongoose.model('Order', orderSchema);
