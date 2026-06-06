# MSukasha Backend API

Complete backend for **msukasha.com** (buyer portal) and **sellermsukasha.com** (seller portal).

---

## 🚀 Setup

```bash
npm install
cp .env.example .env   # .env mein MONGO_URI aur JWT_SECRET dalo
npm run dev            # Local dev
```

### Vercel pe deploy karo
```bash
vercel --prod
```

Vercel Dashboard → Settings → Environment Variables mein ye add karo:
| Key | Value |
|-----|-------|
| `MONGO_URI` | `mongodb+srv://...` |
| `JWT_SECRET` | `your_secret_here` |

---

## 📋 API Endpoints

### 🔐 AUTH (`/api/auth`)
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Buyer register |
| POST | `/api/auth/login` | Buyer login |
| GET  | `/api/auth/me` | Buyer profile (🔒) |
| PUT  | `/api/auth/me` | Profile update (🔒) |
| PUT  | `/api/auth/change-password` | Password change (🔒) |
| POST | `/api/auth/seller/register` | Seller register |
| POST | `/api/auth/seller/login` | Seller login |
| GET  | `/api/auth/seller/me` | Seller profile (🔒 Seller) |
| PUT  | `/api/auth/seller/me` | Seller profile update (🔒 Seller) |
| PUT  | `/api/auth/seller/change-password` | Seller password change (🔒 Seller) |

### 🛍️ PRODUCTS (`/api/products`)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET  | `/api/products` | All products (filters: category, search, minPrice, maxPrice, sort, page, limit) |
| GET  | `/api/products/featured` | Featured products |
| GET  | `/api/products/categories` | Category list |
| GET  | `/api/products/:id` | Single product |
| GET  | `/api/products/seller/my` | Seller ke products (🔒 Seller) |
| POST | `/api/products/seller/add` | Product add karo (🔒 Seller) |
| PUT  | `/api/products/seller/:id` | Product update (🔒 Seller) |
| DELETE | `/api/products/seller/:id` | Product delete (🔒 Seller) |
| GET  | `/api/products/admin/pending` | Pending products (🔒 Admin) |
| PUT  | `/api/products/admin/:id/status` | Status change (🔒 Admin) |
| PUT  | `/api/products/admin/:id/featured` | Featured toggle (🔒 Admin) |

### 📦 ORDERS (`/api/orders`)
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/orders` | Order place karo (🔒 Buyer) |
| GET  | `/api/orders/my` | Buyer ke orders (🔒 Buyer) |
| GET  | `/api/orders/my/:id` | Order detail (🔒 Buyer) |
| PUT  | `/api/orders/my/:id/cancel` | Order cancel (🔒 Buyer) |
| GET  | `/api/orders/seller` | Seller ke orders (🔒 Seller) |
| GET  | `/api/orders/seller/stats` | Sales stats (🔒 Seller) |
| PUT  | `/api/orders/seller/:id/status` | Order status update (🔒 Seller) |
| GET  | `/api/orders/admin/all` | All orders (🔒 Admin) |

### 🛒 CART (`/api/cart`) — 🔒 Buyer
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET  | `/api/cart` | Cart dekho |
| POST | `/api/cart/add` | Item add karo |
| PUT  | `/api/cart/update` | Qty update |
| DELETE | `/api/cart/remove/:productId` | Item remove |
| DELETE | `/api/cart/clear` | Cart clear |

### ❤️ WISHLIST (`/api/wishlist`) — 🔒 Buyer
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET  | `/api/wishlist` | Wishlist dekho |
| POST | `/api/wishlist/toggle/:productId` | Add ya remove toggle |
| DELETE | `/api/wishlist/clear` | Clear |

### ⭐ REVIEWS (`/api/reviews`)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET  | `/api/reviews/:productId` | Product reviews |
| POST | `/api/reviews/:productId` | Review likho (🔒 Buyer) |
| PUT  | `/api/reviews/:id` | Review edit (🔒 Buyer) |
| DELETE | `/api/reviews/:id` | Review delete (🔒 Buyer) |

### 📩 MESSAGES (`/api/messages`)
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/messages` | Contact form (Public) |
| POST | `/api/messages/auth` | Logged in user ka message (🔒) |
| GET  | `/api/messages/admin` | All messages (🔒 Admin) |
| PUT  | `/api/messages/admin/:id/status` | Status update (🔒 Admin) |
| DELETE | `/api/messages/admin/:id` | Delete (🔒 Admin) |

### 💼 JOB APPLICATIONS (`/api/applications`)
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/applications` | Job apply karo (Public) |
| GET  | `/api/applications/admin` | All applications (🔒 Admin) |
| GET  | `/api/applications/admin/:id` | Single application (🔒 Admin) |
| PUT  | `/api/applications/admin/:id/status` | Status update (🔒 Admin) |
| DELETE | `/api/applications/admin/:id` | Delete (🔒 Admin) |

### 🏪 SELLERS (`/api/sellers`)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET  | `/api/sellers` | Public seller list |
| GET  | `/api/sellers/:id` | Seller public profile |
| GET  | `/api/sellers/dashboard/stats` | Full dashboard (🔒 Seller) |
| GET  | `/api/sellers/dashboard/inventory` | Inventory (🔒 Seller) |
| PUT  | `/api/sellers/dashboard/inventory/:id` | Stock update (🔒 Seller) |
| GET  | `/api/sellers/admin/all` | All sellers (🔒 Admin) |
| PUT  | `/api/sellers/admin/:id/status` | Approve/Reject (🔒 Admin) |

### 🔧 ADMIN (`/api/admin`) — 🔒 Admin Only
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET  | `/api/admin/dashboard` | Full dashboard stats |
| GET  | `/api/admin/users` | All buyers |
| PUT  | `/api/admin/users/:id/toggle` | Active/Inactive toggle |
| DELETE | `/api/admin/users/:id` | User delete |
| GET  | `/api/admin/analytics` | Revenue analytics |
| GET  | `/api/admin/me` | Admin profile |

---

## 🔑 Authentication

**Buyer/Admin token:**
```
Authorization: Bearer <token>
```

**Seller token:**
```
Authorization: Bearer <token>   (role: seller)
```

---

## 📁 Project Structure

```
msukasha-backend/
├── server.js              # Main entry
├── package.json
├── vercel.json
├── .env                   # Local env (gitignore mein hai)
├── models/
│   ├── User.js            # Buyers
│   ├── Seller.js          # Sellers
│   ├── Product.js
│   ├── Order.js
│   ├── Review.js
│   ├── Message.js
│   ├── Application.js
│   └── Cart.js
├── middleware/
│   ├── auth.js            # Buyer/Admin JWT
│   └── sellerAuth.js      # Seller JWT
└── routes/
    ├── auth.js
    ├── products.js
    ├── orders.js
    ├── cart.js
    ├── wishlist.js
    ├── reviews.js
    ├── messages.js
    ├── applications.js
    ├── sellers.js
    └── admin.js
```

---

## 💳 Payment Methods Supported
- COD (Cash on Delivery)
- JazzCash
- EasyPaisa
- Bank Transfer
- Debit/Credit Card

## 🌐 CORS Allowed Origins
- https://msukasha.com
- https://www.msukasha.com
- https://sellermsukasha.com
- https://www.sellermsukasha.com
- http://localhost:3000 (dev)
- http://127.0.0.1:5500 (dev)
