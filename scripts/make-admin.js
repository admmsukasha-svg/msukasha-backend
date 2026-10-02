// Usage:  node scripts/make-admin.js you@example.com
// The account must already be registered on the website.
require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../src/models/User');

(async () => {
  const email = (process.argv[2] || '').trim().toLowerCase();
  if (!email) { console.error('Usage: node scripts/make-admin.js you@example.com'); process.exit(1); }
  await mongoose.connect(process.env.MONGODB_URI);
  const user = await User.findOneAndUpdate({ email }, { role: 'admin', accountType: 'admin' }, { new: true });
  console.log(user ? `${email} is now an admin.` : `No user found with email ${email}. Register it first.`);
  await mongoose.disconnect();
})().catch((e) => { console.error(e.message); process.exit(1); });
