import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { scrapeAmazon } from './scrapers/amazonScraper.js';
import { scrapeFlipkart } from './scrapers/flipkartScraper.js';
import { Wishlist } from './models/Wishlist.js';
import { User } from './models/User.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;
const memoryWishlist = new Map();
let mongoEnabled = false;

app.use(cors());
app.use(express.json());

const initDb = async () => {
  const mongoUri = process.env.MONGO_URI;
  if (!mongoUri) {
    console.log('MONGO_URI not set, wishlist will use in-memory storage.');
    return;
  }

  try {
    await mongoose.connect(mongoUri, { dbName: process.env.MONGO_DB_NAME || 'unicart' });
    mongoEnabled = true;
    console.log('Connected to MongoDB Atlas for wishlist persistence.');
  } catch (dbError) {
    console.error('Mongo connection failed, using in-memory wishlist fallback:', dbError.message);
  }
};

const normalizeWishlistItem = (product) => ({
  title: product?.title || 'Untitled Product',
  price: Number(product?.price || 0),
  image: product?.image || '',
  link: product?.link || '',
  source: product?.source || ''
});

const getWishlist = async (userId) => {
  if (mongoEnabled) {
    const doc = await Wishlist.findOne({ userId }).lean();
    return doc?.items || [];
  }

  return memoryWishlist.get(userId) || [];
};

const saveWishlist = async (userId, items) => {
  if (mongoEnabled) {
    await Wishlist.findOneAndUpdate(
      { userId },
      { userId, items },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    return;
  }

  memoryWishlist.set(userId, items);
};

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    message: 'Price Comparison API is running',
    mongodbConnected: mongoEnabled
  });
});

// Search products from both platforms
app.get('/api/search', async (req, res) => {
  const { query } = req.query;
  
  if (!query) {
    return res.status(400).json({ error: 'Search query is required' });
  }

  try {
    console.log(`Searching for: ${query}`);
    
    // Scrape both platforms in parallel
    const [amazonProducts, flipkartProducts] = await Promise.allSettled([
      scrapeAmazon(query),
      scrapeFlipkart(query)
    ]);

    const results = {
      amazon: amazonProducts.status === 'fulfilled' ? amazonProducts.value : [],
      flipkart: flipkartProducts.status === 'fulfilled' ? flipkartProducts.value : [],
      query,
      timestamp: new Date().toISOString()
    };

    // Log any errors
    if (amazonProducts.status === 'rejected') {
      console.error('Amazon scraping error:', amazonProducts.reason);
    }
    if (flipkartProducts.status === 'rejected') {
      console.error('Flipkart scraping error:', flipkartProducts.reason);
    }

    res.json(results);
  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({ error: 'Failed to fetch products', details: error.message });
  }
});

// Get Amazon products only
app.get('/api/amazon', async (req, res) => {
  const { query } = req.query;
  
  if (!query) {
    return res.status(400).json({ error: 'Search query is required' });
  }

  try {
    const products = await scrapeAmazon(query);
    res.json({ products, source: 'amazon', query });
  } catch (error) {
    console.error('Amazon scraping error:', error);
    res.status(500).json({ error: 'Failed to fetch Amazon products', details: error.message });
  }
});

// Get Flipkart products only
app.get('/api/flipkart', async (req, res) => {
  const { query } = req.query;
  
  if (!query) {
    return res.status(400).json({ error: 'Search query is required' });
  }

  try {
    const products = await scrapeFlipkart(query);
    res.json({ products, source: 'flipkart', query });
  } catch (error) {
    console.error('Flipkart scraping error:', error);
    res.status(500).json({ error: 'Failed to fetch Flipkart products', details: error.message });
  }
});

// Auth endpoints
app.post('/api/auth/signup', async (req, res) => {
  const { name, email, password } = req.body;

  if (!name?.trim() || !email?.trim() || !password?.trim()) {
    return res.status(400).json({ error: 'name, email and password are required' });
  }

  try {
    const normalizedEmail = email.trim().toLowerCase();
    const existing = await User.findOne({ email: normalizedEmail }).lean();
    if (existing) return res.status(409).json({ error: 'Email already registered' });

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await User.create({ name: name.trim(), email: normalizedEmail, passwordHash });

    res.status(201).json({
      user: {
        id: String(user._id),
        name: user.name,
        email: user.email
      }
    });
  } catch (authError) {
    res.status(500).json({ error: 'Signup failed', details: authError.message });
  }
});

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email?.trim() || !password?.trim()) {
    return res.status(400).json({ error: 'email and password are required' });
  }

  try {
    const normalizedEmail = email.trim().toLowerCase();
    const user = await User.findOne({ email: normalizedEmail });
    if (!user) return res.status(401).json({ error: 'Invalid email or password' });

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) return res.status(401).json({ error: 'Invalid email or password' });

    res.json({
      user: {
        id: String(user._id),
        name: user.name,
        email: user.email
      }
    });
  } catch (authError) {
    res.status(500).json({ error: 'Login failed', details: authError.message });
  }
});

// Wishlist endpoints
app.get('/api/wishlist/:userId', async (req, res) => {
  const { userId } = req.params;
  if (!userId) return res.status(400).json({ error: 'userId is required' });

  try {
    const items = await getWishlist(userId);
    res.json({ userId, items });
  } catch (wishlistError) {
    res.status(500).json({ error: 'Failed to fetch wishlist', details: wishlistError.message });
  }
});

app.post('/api/wishlist', async (req, res) => {
  const { userId, product } = req.body;
  if (!userId || !product?.link) {
    return res.status(400).json({ error: 'userId and product.link are required' });
  }

  try {
    const item = normalizeWishlistItem(product);
    const existingItems = await getWishlist(userId);
    const alreadyExists = existingItems.some((wishlistItem) => wishlistItem.link === item.link);
    const nextItems = alreadyExists ? existingItems : [item, ...existingItems];
    await saveWishlist(userId, nextItems);
    res.json({ userId, items: nextItems });
  } catch (wishlistError) {
    res.status(500).json({ error: 'Failed to save wishlist', details: wishlistError.message });
  }
});

app.delete('/api/wishlist', async (req, res) => {
  const { userId, productLink } = req.body;
  if (!userId || !productLink) {
    return res.status(400).json({ error: 'userId and productLink are required' });
  }

  try {
    const existingItems = await getWishlist(userId);
    const nextItems = existingItems.filter((wishlistItem) => wishlistItem.link !== productLink);
    await saveWishlist(userId, nextItems);
    res.json({ userId, items: nextItems });
  } catch (wishlistError) {
    res.status(500).json({ error: 'Failed to delete wishlist item', details: wishlistError.message });
  }
});

initDb().finally(() => {
  const server = app.listen(PORT, () => {
    console.log(`UniCart server running on http://localhost:${PORT}`);
  });

  server.on('error', (listenError) => {
    if (listenError?.code === 'EADDRINUSE') {
      console.error(`Port ${PORT} is already in use. Stop the old process or run with another port.`);
      console.error('Windows helper: npx kill-port 5000');
      process.exit(1);
    }

    console.error('Server startup error:', listenError);
    process.exit(1);
  });
});
