const express  = require('express');
const mongoose = require('mongoose');
const cors     = require('cors');
const dotenv   = require('dotenv');

dotenv.config();

const app = express();

// ── MongoDB cached connection (Vercel ke liye) ──
let isConnected = false;
async function connectDB() {
  if (isConnected) return;
  try {
    await mongoose.connect(process.env.MONGO_URI, { dbName: 'msukasha' });
    isConnected = true;
    console.log('✅ MongoDB Connected!');
  } catch (err) {
    console.error('❌ MongoDB Error:', err.message);
    throw err;
  }
}

// ── DB connect PEHLE (middleware order sahi hona chahiye) ──
app.use(async (req, res, next) => {
  try {
    await connectDB();
    next();
  } catch (err) {
    res.status(500).json({ success: false, message: 'Database connection failed' });
  }
});

// ── CORS — msukasha.com + sellermsukasha.com ──
app.use(cors({
  origin: [
    'https://msukasha.com',
    'https://www.msukasha.com',
    'https://sellermsukasha.com',
    'https://www.sellermsukasha.com',
    'http://localhost:3000',
    'http://localhost:5000',
    'http://127.0.0.1:5500'
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ── Routes ──
// Auth (buyers + sellers)
app.use('/api/auth',         require('./routes/auth'));

// Products
app.use('/api/products',     require('./routes/products'));

// Orders
app.use('/api/orders',       require('./routes/orders'));

// Sellers (seller portal)
app.use('/api/sellers',      require('./routes/sellers'));

// Cart & Wishlist
app.use('/api/cart',         require('./routes/cart'));
app.use('/api/wishlist',     require('./routes/wishlist'));

// Reviews
app.use('/api/reviews',      require('./routes/reviews'));

// Messages / Contact
app.use('/api/messages',     require('./routes/messages'));

// Job Applications
app.use('/api/applications', require('./routes/applications'));

// Admin
app.use('/api/admin',        require('./routes/admin'));

// ── Health Check ──
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'MSukasha API is running!',
    version: '1.0.0',
    endpoints: {
      auth:         '/api/auth',
      products:     '/api/products',
      orders:       '/api/orders',
      sellers:      '/api/sellers',
      cart:         '/api/cart',
      wishlist:     '/api/wishlist',
      reviews:      '/api/reviews',
      messages:     '/api/messages',
      applications: '/api/applications',
      admin:        '/api/admin'
    },
    timestamp: new Date().toISOString()
  });
});

// ── 404 ──
app.use((req, res) => {
  res.status(404).json({ success: false, message: `Route ${req.originalUrl} not found` });
});

// ── Global Error Handler ──
app.use((err, req, res, next) => {
  console.error('Server Error:', err);
  res.status(500).json({ success: false, message: err.message || 'Internal server error' });
});

// ── Local dev ──
if (process.env.NODE_ENV !== 'production') {
  const PORT = process.env.PORT || 5000;
  connectDB().then(() => {
    app.listen(PORT, () => console.log(`🚀 Server running on http://localhost:${PORT}`));
  });
}

// ── Vercel export ──
module.exports = app;
