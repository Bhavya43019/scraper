import puppeteer from 'puppeteer';

/**
 * Scrape Amazon India for products matching the search query
 * @param {string} query - Search query
 * @returns {Promise<Array>} - Array of product objects
 */
export async function scrapeAmazon(query) {
    let browser;

    try {
        browser = await puppeteer.launch({
            headless: 'new',
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--no-first-run',
                '--no-zygote',
                '--disable-gpu'
            ]
        });

        const page = await browser.newPage();

        // Set a realistic user agent
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

        // Set viewport
        await page.setViewport({ width: 1366, height: 768 });

        // Navigate to Amazon search
        const searchUrl = `https://www.amazon.in/s?k=${encodeURIComponent(query)}`;
        console.log(`Scraping Amazon: ${searchUrl}`);

        await page.goto(searchUrl, {
            waitUntil: 'networkidle2',
            timeout: 30000
        });

        // Wait for products to load
        await page.waitForSelector('[data-component-type="s-search-result"]', { timeout: 10000 }).catch(() => {
            console.log('Amazon: No products found with primary selector, trying fallback');
        });

        // Extract product data
        const products = await page.evaluate(() => {
            const items = [];
            const productCards = document.querySelectorAll('[data-component-type="s-search-result"]');

            productCards.forEach((card, index) => {
                if (index >= 20) return; // Limit to 20 products

                try {
                    // Get title
                    const titleElement = card.querySelector('h2 a span') || card.querySelector('.a-size-medium');
                    const title = titleElement?.textContent?.trim() || '';

                    // Get price
                    const priceElement = card.querySelector('.a-price .a-offscreen') ||
                        card.querySelector('.a-price-whole');
                    let price = priceElement?.textContent?.trim() || '';

                    // Clean price
                    price = price.replace(/[^\d,]/g, '').replace(/,/g, '');
                    const priceNum = parseFloat(price) || 0;

                    // Get original price (MRP)
                    const originalPriceElement = card.querySelector('.a-text-price .a-offscreen') ||
                        card.querySelector('.a-text-price');
                    let originalPrice = originalPriceElement?.textContent?.trim() || '';
                    originalPrice = originalPrice.replace(/[^\d,]/g, '').replace(/,/g, '');
                    const originalPriceNum = parseFloat(originalPrice) || priceNum;

                    // Get image
                    const imageElement = card.querySelector('.s-image');
                    const image = imageElement?.src || '';

                    // Get link
                    const linkElement = card.querySelector('h2 a') || card.querySelector('a.a-link-normal');
                    let link = linkElement?.href || '';
                    if (link && !link.startsWith('http')) {
                        link = 'https://www.amazon.in' + link;
                    }

                    // Get rating
                    const ratingElement = card.querySelector('.a-icon-star-small .a-icon-alt') ||
                        card.querySelector('.a-icon-alt');
                    const ratingText = ratingElement?.textContent || '';
                    const rating = parseFloat(ratingText.match(/[\d.]+/)?.[0]) || 0;

                    // Get review count
                    const reviewElement = card.querySelector('span[aria-label*="ratings"]') ||
                        card.querySelector('.a-size-base.s-underline-text');
                    const reviewText = reviewElement?.textContent || '';
                    const reviews = parseInt(reviewText.replace(/[^\d]/g, '')) || 0;

                    // Get delivery info
                    const deliveryElement = card.querySelector('.a-row.a-size-base .a-color-base');
                    const delivery = deliveryElement?.textContent?.trim() || '';

                    if (title && priceNum > 0) {
                        items.push({
                            title,
                            price: priceNum,
                            originalPrice: originalPriceNum,
                            discount: originalPriceNum > priceNum ? Math.round((1 - priceNum / originalPriceNum) * 100) : 0,
                            image,
                            link,
                            rating,
                            reviews,
                            delivery,
                            source: 'amazon',
                            currency: '₹'
                        });
                    }
                } catch (e) {
                    console.log('Error parsing product:', e);
                }
            });

            return items;
        });

        console.log(`Amazon: Found ${products.length} products`);
        return products;

    } catch (error) {
        console.error('Amazon scraping error:', error);
        throw error;
    } finally {
        if (browser) {
            await browser.close();
        }
    }
}
