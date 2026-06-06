const mongoose = require('mongoose');

const cartItemSchema = new mongoose.Schema({
  product:  { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  qty:      { type: Number, required: true, min: 1, default: 1 },
  price:    { type: Number, required: true }
}, { _id: false });

const cartSchema = new mongoose.Schema({
  buyer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },
  items: [cartItemSchema]
}, { timestamps: true });

// Total calculate karo
cartSchema.virtual('total').get(function () {
  return this.items.reduce((sum, item) => sum + item.price * item.qty, 0);
});

module.exports = mongoose.model('Cart', cartSchema);
