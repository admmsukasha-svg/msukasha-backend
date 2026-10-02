const mongoose = require('mongoose');
const applyJSON = require('./_json');

const schema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 120 },
  firstName: { type: String, default: '', maxlength: 60 },
  lastName: { type: String, default: '', maxlength: 60 },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true, maxlength: 254 },
  passwordHash: { type: String, required: true, select: false },
  phone: { type: String, default: '', maxlength: 30 },
  city: { type: String, default: '', maxlength: 80 },
  companyName: { type: String, default: '', maxlength: 160 },
  role: { type: String, enum: ['buyer', 'seller', 'admin'], default: 'buyer' },
  accountType: { type: String, default: 'buyer' },
  profile: {
    about: { type: String, default: '', maxlength: 1000 },
    address: { type: String, default: '', maxlength: 300 },
    joinedAt: { type: Date, default: Date.now }
  },
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

applyJSON(schema, ['passwordHash']);
// api.js reads user.uid, so always include it.
schema.set('toJSON', {
  transform: (doc, ret) => {
    ret.id = String(ret._id);
    ret.uid = ret.id;
    delete ret._id; delete ret.__v; delete ret.passwordHash;
    return ret;
  }
});

module.exports = mongoose.models.User || mongoose.model('User', schema);
