const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema({
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true
  },
  buyer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  order: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order'
  },
  rating: {
    type: Number,
    required: [true, 'Rating is required'],
    min: 1,
    max: 5
  },
  title: {
    type: String,
    trim: true,
    maxlength: 100
  },
  comment: {
    type: String,
    trim: true,
    maxlength: 1000
  },
  images: [String],
  isVerifiedPurchase: {
    type: Boolean,
    default: false
  },
  helpfulVotes: {
    type: Number,
    default: 0
  }
}, { timestamps: true });

// Ek user ek product ko ek baar hi review de sakta hai
reviewSchema.index({ product: 1, buyer: 1 }, { unique: true });

module.exports = mongoose.model('Review', reviewSchema);
