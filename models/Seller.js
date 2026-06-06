const mongoose = require('mongoose');
const bcrypt   = require('bcryptjs');

const sellerSchema = new mongoose.Schema({
  businessName: {
    type: String,
    required: [true, 'Business name is required'],
    trim: true,
    minlength: 2,
    maxlength: 100
  },
  ownerName: {
    type: String,
    required: [true, 'Owner name is required'],
    trim: true
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\S+@\S+\.\S+$/, 'Invalid email format']
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: 6,
    select: false
  },
  phone: {
    type: String,
    required: [true, 'Phone is required'],
    trim: true
  },
  cnic: {
    type: String,
    trim: true
  },
  businessType: {
    type: String,
    enum: ['sole_proprietor', 'partnership', 'pvt_ltd', 'other'],
    default: 'sole_proprietor'
  },
  logo: {
    type: String,
    default: ''
  },
  description: {
    type: String,
    default: ''
  },
  address: {
    street:   { type: String, default: '' },
    city:     { type: String, default: '' },
    province: { type: String, default: '' },
    zip:      { type: String, default: '' }
  },
  bankDetails: {
    bankName:      { type: String, default: '' },
    accountTitle:  { type: String, default: '' },
    accountNumber: { type: String, default: '' },
    iban:          { type: String, default: '' }
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected', 'suspended'],
    default: 'pending'
  },
  isActive: {
    type: Boolean,
    default: true
  },
  // Stats
  totalProducts:  { type: Number, default: 0 },
  totalOrders:    { type: Number, default: 0 },
  totalRevenue:   { type: Number, default: 0 },
  rating:         { type: Number, default: 0, min: 0, max: 5 },
  totalReviews:   { type: Number, default: 0 }
}, { timestamps: true });

sellerSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

sellerSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('Seller', sellerSchema);
