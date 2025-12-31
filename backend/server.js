import express from 'express';
import cors from 'cors';
import { scrapeAmazon } from './scrapers/amazonScraper.js';
import { scrapeFlipkart } from './scrapers/flipkartScraper.js';

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Price Comparison API is running' });
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

app.listen(PORT, () => {
  console.log(`🚀 Price Comparison Server running on http://localhost:${PORT}`);
});
