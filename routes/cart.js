const express = require('express');
const router  = express.Router();
const Cart    = require('../models/Cart');
const Product = require('../models/Product');
const { protect } = require('../middleware/auth');

// GET /api/cart — Cart dekho
router.get('/', protect, async (req, res) => {
  try {
    let cart = await Cart.findOne({ buyer: req.user._id })
      .populate('items.product', 'name images price salePrice stock status seller');

    if (!cart) {
      cart = { items: [], total: 0 };
    }

    // Active products filter karo
    const validItems = cart.items ? cart.items.filter(i => i.product && i.product.status === 'active') : [];
    const total = validItems.reduce((sum, i) => {
      const price = i.product.salePrice || i.product.price;
      return sum + price * i.qty;
    }, 0);

    res.json({ success: true, items: validItems, total, itemCount: validItems.length });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/cart/add — Product add karo
router.post('/add', protect, async (req, res) => {
  try {
    const { productId, qty = 1 } = req.body;

    const product = await Product.findById(productId);
    if (!product || product.status !== 'active') {
      return res.status(404).json({ success: false, message: 'Product available nahi hai' });
    }
    if (product.stock < qty) {
      return res.status(400).json({ success: false, message: `Stock sirf ${product.stock} available hai` });
    }

    const price = product.salePrice || product.price;
    let cart = await Cart.findOne({ buyer: req.user._id });

    if (!cart) {
      cart = new Cart({ buyer: req.user._id, items: [] });
    }

    const existingItem = cart.items.find(i => i.product.toString() === productId);
    if (existingItem) {
      const newQty = existingItem.qty + qty;
      if (newQty > product.stock) {
        return res.status(400).json({ success: false, message: 'Itna stock nahi hai' });
      }
      existingItem.qty = newQty;
    } else {
      cart.items.push({ product: productId, qty, price });
    }

    await cart.save();
    res.json({ success: true, message: 'Cart mein add ho gaya', itemCount: cart.items.length });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PUT /api/cart/update — Qty update karo
router.put('/update', protect, async (req, res) => {
  try {
    const { productId, qty } = req.body;
    if (qty < 1) return res.status(400).json({ success: false, message: 'Qty 1 se kam nahi ho sakti' });

    const product = await Product.findById(productId);
    if (!product) return res.status(404).json({ success: false, message: 'Product nahi mila' });
    if (product.stock < qty) {
      return res.status(400).json({ success: false, message: `Stock sirf ${product.stock} available hai` });
    }

    const cart = await Cart.findOne({ buyer: req.user._id });
    if (!cart) return res.status(404).json({ success: false, message: 'Cart nahi mili' });

    const item = cart.items.find(i => i.product.toString() === productId);
    if (!item) return res.status(404).json({ success: false, message: 'Item cart mein nahi hai' });

    item.qty = qty;
    await cart.save();
    res.json({ success: true, message: 'Cart update ho gayi' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// DELETE /api/cart/remove/:productId — Item remove karo
router.delete('/remove/:productId', protect, async (req, res) => {
  try {
    const cart = await Cart.findOne({ buyer: req.user._id });
    if (!cart) return res.status(404).json({ success: false, message: 'Cart nahi mili' });

    cart.items = cart.items.filter(i => i.product.toString() !== req.params.productId);
    await cart.save();
    res.json({ success: true, message: 'Item remove ho gaya' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// DELETE /api/cart/clear — Cart clear karo
router.delete('/clear', protect, async (req, res) => {
  try {
    await Cart.findOneAndUpdate({ buyer: req.user._id }, { items: [] });
    res.json({ success: true, message: 'Cart clear ho gayi' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
