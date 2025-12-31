import puppeteer from 'puppeteer';

/**
 * Scrape Flipkart for products matching the search query
 * @param {string} query - Search query
 * @returns {Promise<Array>} - Array of product objects
 */
export async function scrapeFlipkart(query) {
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

        // Navigate to Flipkart search
        const searchUrl = `https://www.flipkart.com/search?q=${encodeURIComponent(query)}`;
        console.log(`Scraping Flipkart: ${searchUrl}`);

        await page.goto(searchUrl, {
            waitUntil: 'networkidle2',
            timeout: 30000
        });

        // Close login popup if it appears - try multiple selectors
        try {
            const closeSelectors = ['button._2KpZ6l._2doB4z', 'button[class*="close"]', '[class*="Modal"] button'];
            for (const selector of closeSelectors) {
                const closeButton = await page.$(selector);
                if (closeButton) {
                    await closeButton.click();
                    await new Promise(r => setTimeout(r, 500));
                    break;
                }
            }
        } catch (e) {
            // Popup might not appear, continue
        }

        // Wait for products to load - try multiple selectors
        const waitSelectors = ['a.k7wcnx', 'a.CGtC98', '[data-id]', '._1AtVbE'];
        for (const selector of waitSelectors) {
            try {
                await page.waitForSelector(selector, { timeout: 5000 });
                console.log(`Flipkart: Found products with selector: ${selector}`);
                break;
            } catch (e) {
                continue;
            }
        }

        // Small delay to ensure content is fully loaded
        await new Promise(r => setTimeout(r, 1000));

        // Extract product data
        const products = await page.evaluate(() => {
            const items = [];

            // Updated selectors for Flipkart's current layout (December 2025)
            // Product cards can be anchor tags with various classes
            const cardSelectors = [
                'a.k7wcnx',           // New list view cards
                'a.CGtC98',           // Grid view cards
                'a._1fQZEK',          // Alternative grid cards
                'a.s1Q9rs',           // Another variant
                '[data-id]',          // Legacy selector
                '._1AtVbE',            // Legacy container
                '._4ddWXP',            // Alternative layout
                '.slAVV4'              // Mobile-style layout
            ];

            let productCards = [];
            for (const selector of cardSelectors) {
                productCards = document.querySelectorAll(selector);
                if (productCards.length > 0) {
                    console.log(`Using selector: ${selector}, found ${productCards.length} cards`);
                    break;
                }
            }

            // If still no products, try getting all anchor links that go to product pages
            if (productCards.length === 0) {
                productCards = document.querySelectorAll('a[href*="/p/"]');
            }

            productCards.forEach((card, index) => {
                if (index >= 20) return; // Limit to 20 products

                try {
                    // Get the link first - if card is an anchor, use it directly
                    let link = '';
                    if (card.tagName === 'A') {
                        link = card.href || '';
                    } else {
                        const linkElement = card.querySelector('a[href*="/p/"]') ||
                            card.querySelector('a.CGtC98') ||
                            card.querySelector('a._1fQZEK') ||
                            card.querySelector('a.s1Q9rs') ||
                            card.querySelector('a.k7wcnx') ||
                            card.querySelector('a');
                        link = linkElement?.href || '';
                    }

                    // Ensure proper full URL
                    if (link && !link.startsWith('http')) {
                        link = 'https://www.flipkart.com' + link;
                    }

                    // Get title - updated selectors (December 2025)
                    const titleElement = card.querySelector('.RG5Slk') ||     // New title class
                        card.querySelector('.KzDlHZ') ||
                        card.querySelector('.KzD1Z1') ||
                        card.querySelector('.IRpwTa') ||
                        card.querySelector('._4rR01T') ||
                        card.querySelector('.s1Q9rs') ||
                        card.querySelector('.WKTcLC a') ||
                        card.querySelector('[class*="title"]') ||
                        card.querySelector('a[title]') ||
                        card.querySelector('div[class*="name"]');
                    let title = titleElement?.textContent?.trim() || titleElement?.title || card.getAttribute('title') || '';

                    // Get price - updated selectors (December 2025)
                    const priceElement = card.querySelector('.hZ3P6w') ||      // New price class
                        card.querySelector('.Nx930q') ||
                        card.querySelector('.Nx9bqj._4b5DiR') ||
                        card.querySelector('.Nx9bqj') ||
                        card.querySelector('._30jeq3') ||
                        card.querySelector('._1_WHN1') ||
                        card.querySelector('[class*="price"]');
                    let price = priceElement?.textContent?.trim() || '';
                    price = price.replace(/[^\d,]/g, '').replace(/,/g, '');
                    const priceNum = parseFloat(price) || 0;

                    // Get original price
                    const originalPriceElement = card.querySelector('.yRaY8j.ZYYwLA') ||
                        card.querySelector('.yRaY8j') ||
                        card.querySelector('._3I9_wc') ||
                        card.querySelector('._27UcVY') ||
                        card.querySelector('[class*="strike"]');
                    let originalPrice = originalPriceElement?.textContent?.trim() || '';
                    originalPrice = originalPrice.replace(/[^\d,]/g, '').replace(/,/g, '');
                    const originalPriceNum = parseFloat(originalPrice) || priceNum;

                    // Get discount
                    const discountElement = card.querySelector('.UkUFwK span') ||
                        card.querySelector('.UkUFwK') ||
                        card.querySelector('._3Ay6Sb span') ||
                        card.querySelector('.WAtFn6') ||
                        card.querySelector('[class*="discount"]');
                    let discountText = discountElement?.textContent || '';
                    let discount = parseInt(discountText.replace(/[^\d]/g, '')) || 0;

                    // Calculate discount if not found
                    if (!discount && originalPriceNum > priceNum) {
                        discount = Math.round((1 - priceNum / originalPriceNum) * 100);
                    }

                    // Get image - updated selectors
                    const imageElement = card.querySelector('img.UCc1lI') ||   // New image class
                        card.querySelector('img.DByuf4') ||
                        card.querySelector('img._53J4C-') ||
                        card.querySelector('img._396cs4') ||
                        card.querySelector('img[src*="rukminim"]') ||
                        card.querySelector('img');
                    const image = imageElement?.src || '';

                    // Get rating - updated selectors
                    const ratingElement = card.querySelector('.MKiFS6') ||     // New rating class
                        card.querySelector('.XQD_n7') ||
                        card.querySelector('.XQDdHH') ||
                        card.querySelector('._3LWZlK') ||
                        card.querySelector('[class*="rating"]');
                    const rating = parseFloat(ratingElement?.textContent) || 0;

                    // Get reviews/ratings count
                    const reviewElement = card.querySelector('.Wphh3N span span:last-child') ||
                        card.querySelector('.Wphh3N span') ||
                        card.querySelector('.Wphh3N') ||
                        card.querySelector('._2_R_DZ span') ||
                        card.querySelector('[class*="review"]');
                    const reviewText = reviewElement?.textContent || '';
                    const reviews = parseInt(reviewText.replace(/[^\d]/g, '')) || 0;

                    // Get delivery info
                    const deliveryElement = card.querySelector('._3tcB5a') ||
                        card.querySelector('.sN_axp') ||
                        card.querySelector('[class*="delivery"]');
                    const delivery = deliveryElement?.textContent?.trim() || '';

                    // Check for Flipkart Assured
                    const assuredElement = card.querySelector('._1LsLwN') ||
                        card.querySelector('img[src*="assured"]') ||
                        card.querySelector('[class*="assured"]');
                    const isAssured = !!assuredElement;

                    if (title && priceNum > 0 && link) {
                        items.push({
                            title,
                            price: priceNum,
                            originalPrice: originalPriceNum,
                            discount,
                            image,
                            link,
                            rating,
                            reviews,
                            delivery,
                            isAssured,
                            source: 'flipkart',
                            currency: '₹'
                        });
                    }
                } catch (e) {
                    console.log('Error parsing product:', e);
                }
            });

            return items;
        });

        console.log(`Flipkart: Found ${products.length} products`);
        return products;

    } catch (error) {
        console.error('Flipkart scraping error:', error);
        throw error;
    } finally {
        if (browser) {
            await browser.close();
        }
    }
}
