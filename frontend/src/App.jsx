import { useState, useCallback, useEffect } from 'react';
import './App.css';

const API_URL = import.meta.env.VITE_API_URL || '/api';
const LOCAL_USER_KEY = 'unicart-user-id';
const LOCAL_AUTH_KEY = 'unicart-auth-active';

function App() {
  const [authMode, setAuthMode] = useState('login');
  const [authDone, setAuthDone] = useState(localStorage.getItem(LOCAL_AUTH_KEY) === 'true');
  const [currentPage, setCurrentPage] = useState('home');
  const [authForm, setAuthForm] = useState({
    name: '',
    email: '',
    password: ''
  });
  const [authMessage, setAuthMessage] = useState('');
  const [userId, setUserId] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);
  const [wishlist, setWishlist] = useState([]);
  const [wishlistLoading, setWishlistLoading] = useState(false);

  const loadWishlist = useCallback(async (id) => {
    if (!id) return;

    setWishlistLoading(true);
    try {
      const response = await fetch(`${API_URL}/wishlist/${encodeURIComponent(id)}`);
      if (!response.ok) throw new Error('Failed to load wishlist');
      const data = await response.json();
      setWishlist(data.items || []);
    } catch (wishlistError) {
      console.error('Wishlist fetch error:', wishlistError);
    } finally {
      setWishlistLoading(false);
    }
  }, []);

  useEffect(() => {
    const savedUserId = localStorage.getItem(LOCAL_USER_KEY);
    if (!savedUserId) {
      setAuthDone(false);
      return;
    }

    setUserId(savedUserId);
    if (authDone) {
      loadWishlist(savedUserId);
    }
  }, [authDone, loadWishlist]);

  const handleSearch = useCallback(async () => {
    if (!searchQuery.trim()) return;

    setIsLoading(true);
    setError(null);
    setResults(null);

    try {
      const response = await fetch(`${API_URL}/search?query=${encodeURIComponent(searchQuery)}`);

      if (!response.ok) {
        throw new Error('Failed to fetch products');
      }

      const data = await response.json();
      setResults(data);
    } catch (err) {
      setError(err.message);
      console.error('Search error:', err);
    } finally {
      setIsLoading(false);
    }
  }, [searchQuery]);

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  // Find best prices between platforms
  const findBestDeals = () => {
    if (!results) return { amazon: [], flipkart: [], savings: 0 };

    const allProducts = [
      ...results.amazon.map(p => ({ ...p, source: 'amazon' })),
      ...results.flipkart.map(p => ({ ...p, source: 'flipkart' }))
    ];

    // Calculate potential savings
    let totalSavings = 0;
    allProducts.forEach(product => {
      if (product.originalPrice > product.price) {
        totalSavings += (product.originalPrice - product.price);
      }
    });

    return {
      amazon: results.amazon,
      flipkart: results.flipkart,
      savings: totalSavings,
      total: results.amazon.length + results.flipkart.length
    };
  };

  const deals = findBestDeals();

  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    if (!authForm.email.trim() || !authForm.password.trim()) {
      setAuthMessage('Email and password are required.');
      return;
    }
    if (authMode === 'signup' && !authForm.name.trim()) {
      setAuthMessage('Name is required for signup.');
      return;
    }

    try {
      const endpoint = authMode === 'signup' ? `${API_URL}/auth/signup` : `${API_URL}/auth/login`;
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: authForm.name,
          email: authForm.email,
          password: authForm.password
        })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Authentication failed');

      const loggedInUserId = data.user?.id;
      if (!loggedInUserId) throw new Error('User account id not found');

      localStorage.setItem(LOCAL_AUTH_KEY, 'true');
      localStorage.setItem(LOCAL_USER_KEY, loggedInUserId);
      setUserId(loggedInUserId);
      setAuthDone(true);
      await loadWishlist(loggedInUserId);
      setAuthMessage(authMode === 'signup' ? 'Signup complete. Welcome to UniCart.' : 'Login successful. Welcome back.');
    } catch (authError) {
      setAuthMessage(authError.message);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem(LOCAL_AUTH_KEY);
    localStorage.removeItem(LOCAL_USER_KEY);
    setAuthDone(false);
    setCurrentPage('home');
    setAuthMessage('');
    setWishlist([]);
    setUserId('');
  };

  const addToWishlist = async (product) => {
    try {
      const response = await fetch(`${API_URL}/wishlist`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, product })
      });
      if (!response.ok) throw new Error('Failed to add product');
      const data = await response.json();
      setWishlist(data.items || []);
    } catch (wishlistError) {
      console.error('Add wishlist error:', wishlistError);
      setError('Unable to add to wishlist right now.');
    }
  };

  const removeFromWishlist = async (productLink) => {
    try {
      const response = await fetch(`${API_URL}/wishlist`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, productLink })
      });
      if (!response.ok) throw new Error('Failed to remove product');
      const data = await response.json();
      setWishlist(data.items || []);
    } catch (wishlistError) {
      console.error('Remove wishlist error:', wishlistError);
    }
  };

  const isInWishlist = (link) => wishlist.some((item) => item.link === link);

  if (!authDone) {
    return (
      <>
        <div className="app-background">
          <div className="gradient-orb orb-1"></div>
          <div className="gradient-orb orb-2"></div>
          <div className="gradient-orb orb-3"></div>
        </div>

        <div className="app-container">
          <header className="header">
            <div className="logo auth-logo">
              <div className="logo-icon">🛍️</div>
              <h1 className="logo-text">UniCart</h1>
            </div>
            <p className="tagline">Welcome to smart online shopping !</p>
          </header>

          <section className="auth-hero">
            <div className="auth-card premium-auth">
              <div>
                <div className="auth-mode-switch">
                  <button
                    className={`auth-switch-btn ${authMode === 'signup' ? 'active' : ''}`}
                    onClick={() => setAuthMode('signup')}
                    type="button"
                  >
                    Sign Up
                  </button>
                  <button
                    className={`auth-switch-btn ${authMode === 'login' ? 'active' : ''}`}
                    onClick={() => setAuthMode('login')}
                    type="button"
                  >
                    Log In
                  </button>
                </div>

                <form className="auth-form" onSubmit={handleAuthSubmit}>
                  {authMode === 'signup' && (
                    <input
                      type="text"
                      className="search-input"
                      placeholder="Full name"
                      value={authForm.name}
                      onChange={(e) => setAuthForm((prev) => ({ ...prev, name: e.target.value }))}
                    />
                  )}
                  <input
                    type="email"
                    className="search-input"
                    placeholder="Email address"
                    value={authForm.email}
                    onChange={(e) => setAuthForm((prev) => ({ ...prev, email: e.target.value }))}
                  />
                  <input
                    type="password"
                    className="search-input"
                    placeholder="Password"
                    value={authForm.password}
                    onChange={(e) => setAuthForm((prev) => ({ ...prev, password: e.target.value }))}
                  />
                  <button className="search-button auth-submit" type="submit">
                    {authMode === 'signup' ? 'Create Account' : 'Log In'}
                  </button>
                </form>

                {authMessage && <p className="auth-message">{authMessage}</p>}
              </div>
            </div>
          </section>
        </div>
      </>
    );
  }

  return (
    <>
      {/* Background Effects */}
      <div className="app-background">
        <div className="gradient-orb orb-1"></div>
        <div className="gradient-orb orb-2"></div>
        <div className="gradient-orb orb-3"></div>
      </div>

      <div className="app-container">
        {/* Header */}
        <header className="header">
          <div className="header-row">
            <div className="logo">
              <div className="logo-icon">🛍️</div>
              <h1 className="logo-text">UniCart</h1>
            </div>
            <div className="header-actions">
              <button type="button" className="header-link-button" onClick={() => setCurrentPage('wishlist')}>
                Wishlist
              </button>
              <button type="button" className="logout-button" onClick={handleLogout}>
                Logout
              </button>
            </div>
          </div>
          <p className="tagline">Scrape products, compare deals, and keep your wishlist forever.</p>
        </header>

        {currentPage === 'wishlist' ? (
          <section className="wishlist-page">
            <div className="section-header">
              <h2 className="section-title">Your Wishlist</h2>
              <button type="button" className="header-link-button" onClick={() => setCurrentPage('home')}>
                ← Back to Search
              </button>
            </div>
            {wishlistLoading && <p className="empty-text">Loading wishlist...</p>}
            {wishlist.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">🧾</div>
                <h3 className="empty-title">Wishlist is empty</h3>
                <p className="empty-text">Search products and add them to your wishlist.</p>
              </div>
            ) : (
              <div className="wishlist-grid">
                {wishlist.map((item) => (
                  <div className="wishlist-item" key={item.link}>
                    <img src={item.image || 'https://via.placeholder.com/60x60'} alt={item.title} className="compare-item-image" />
                    <div className="compare-item-details">
                      <p className="compare-item-title">{item.title}</p>
                      <p className="compare-item-price">₹{Number(item.price || 0).toLocaleString()}</p>
                    </div>
                    <button className="wishlist-remove" onClick={() => removeFromWishlist(item.link)} type="button">
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>
        ) : (
          <>
            <section className="top-controls">
              <div className="search-section">
                <div className="search-container">
                  <div className="search-input-wrapper">
                    <span className="search-icon">🔍</span>
                    <input
                      type="text"
                      className="search-input"
                      placeholder="Search for any product (e.g., iPhone, laptop, headphones...)"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      onKeyPress={handleKeyPress}
                    />
                  </div>
                  <button
                    className="search-button"
                    onClick={handleSearch}
                    disabled={isLoading || !searchQuery.trim()}
                  >
                    {isLoading ? (
                      <>
                        <span className="loading-spinner-small"></span>
                        Searching...
                      </>
                    ) : (
                      <>
                        <span>Compare Prices</span>
                        <span>→</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </section>

            {results && (
              <div className="stats-bar">
                <div className="stat-item">
                  <div className="stat-icon amazon">🛒</div>
                  <div>
                    <div className="stat-label">Amazon Products</div>
                    <div className="stat-value">{results.amazon.length}</div>
                  </div>
                </div>
                <div className="stat-item">
                  <div className="stat-icon flipkart">🛍️</div>
                  <div>
                    <div className="stat-label">Flipkart Products</div>
                    <div className="stat-value">{results.flipkart.length}</div>
                  </div>
                </div>
                <div className="stat-item">
                  <div className="stat-icon savings">💰</div>
                  <div>
                    <div className="stat-label">Potential Savings</div>
                    <div className="stat-value">₹{deals.savings.toLocaleString()}</div>
                  </div>
                </div>
              </div>
            )}

            {isLoading && (
              <div className="loading-container">
                <div className="loading-spinner"></div>
                <div className="loading-text">Searching across platforms...</div>
                <div className="loading-subtext">Comparing prices from Amazon & Flipkart</div>
              </div>
            )}

            {error && (
              <div className="empty-state">
                <div className="empty-icon">❌</div>
                <h3 className="empty-title">Oops! Something went wrong</h3>
                <p className="empty-text">{error}</p>
              </div>
            )}

            {results && !isLoading && (
              <>
                {results.amazon.length > 0 && (
                  <section className="products-section" style={{ marginBottom: '3rem' }}>
                    <div className="section-header">
                      <h2 className="section-title">
                        <span className="source-badge amazon">
                          <span>🛒</span>
                          Amazon India
                        </span>
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem', fontWeight: 400 }}>
                          {results.amazon.length} products found
                        </span>
                      </h2>
                    </div>
                    <div className="products-grid">
                      {results.amazon.map((product, index) => (
                        <ProductCard
                          key={`amazon-${index}`}
                          product={product}
                          onAddToWishlist={addToWishlist}
                          inWishlist={isInWishlist(product.link)}
                        />
                      ))}
                    </div>
                  </section>
                )}

                {results.flipkart.length > 0 && (
                  <section className="products-section">
                    <div className="section-header">
                      <h2 className="section-title">
                        <span className="source-badge flipkart">
                          <span>🛍️</span>
                          Flipkart
                        </span>
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem', fontWeight: 400 }}>
                          {results.flipkart.length} products found
                        </span>
                      </h2>
                    </div>
                    <div className="products-grid">
                      {results.flipkart.map((product, index) => (
                        <ProductCard
                          key={`flipkart-${index}`}
                          product={product}
                          onAddToWishlist={addToWishlist}
                          inWishlist={isInWishlist(product.link)}
                        />
                      ))}
                    </div>
                  </section>
                )}

                {(results.amazon.length > 0 || results.flipkart.length > 0) && (
                  <PriceComparison amazon={results.amazon} flipkart={results.flipkart} />
                )}

                {results.amazon.length === 0 && results.flipkart.length === 0 && (
                  <div className="empty-state">
                    <div className="empty-icon">🔍</div>
                    <h3 className="empty-title">No products found</h3>
                    <p className="empty-text">
                      Try searching for something else or check your spelling
                    </p>
                  </div>
                )}
              </>
            )}

            {!results && !isLoading && !error && (
              <div className="empty-state">
                <div className="empty-icon">🛒</div>
                <h3 className="empty-title">Start Comparing Prices</h3>
                <p className="empty-text">
                  Enter a product name to compare prices across Amazon and Flipkart
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}

// Product Card Component
function ProductCard({ product, onAddToWishlist, inWishlist }) {
  const isAmazon = product.source === 'amazon';

  return (
    <div className={`product-card ${product.source}`}>
      <div className="product-image-container">
        <img
          src={product.image || 'https://via.placeholder.com/200x200?text=No+Image'}
          alt={product.title}
          className="product-image"
          loading="lazy"
        />
        <div className="product-badges">
          {product.discount > 0 && (
            <span className="badge discount">{product.discount}% OFF</span>
          )}
          <span className={`badge source ${product.source}`}>
            {isAmazon ? 'Amazon' : 'Flipkart'}
          </span>
          {product.isAssured && (
            <span className="badge assured">✓ Assured</span>
          )}
        </div>
      </div>

      <div className="product-content">
        <h3 className="product-title">{product.title}</h3>

        {product.rating > 0 && (
          <div className="product-rating">
            <span className="rating-stars">
              <svg viewBox="0 0 24 24"><path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" /></svg>
              {product.rating.toFixed(1)}
            </span>
            {product.reviews > 0 && (
              <span className="rating-count">({product.reviews.toLocaleString()} reviews)</span>
            )}
          </div>
        )}

        <div className="product-pricing">
          <span className="current-price">₹{product.price.toLocaleString()}</span>
          {product.originalPrice > product.price && (
            <span className="original-price">₹{product.originalPrice.toLocaleString()}</span>
          )}
        </div>

        {product.delivery && (
          <div className="product-delivery">
            <span>🚚</span>
            <span>{product.delivery}</span>
          </div>
        )}

        <a
          href={product.link}
          target="_blank"
          rel="noopener noreferrer"
          className={`buy-button ${product.source}`}
        >
          <span>Buy on {isAmazon ? 'Amazon' : 'Flipkart'}</span>
          <span>→</span>
        </a>

        <button
          type="button"
          className="wishlist-add"
          onClick={() => onAddToWishlist(product)}
          disabled={inWishlist}
        >
          {inWishlist ? 'Added to Wishlist' : 'Add to Wishlist'}
        </button>
      </div>
    </div>
  );
}

// Price Comparison Component
function PriceComparison({ amazon, flipkart }) {
  // Get top 5 cheapest from each platform
  const sortedAmazon = [...amazon].sort((a, b) => a.price - b.price).slice(0, 5);
  const sortedFlipkart = [...flipkart].sort((a, b) => a.price - b.price).slice(0, 5);

  const lowestAmazon = sortedAmazon[0]?.price || Infinity;
  const lowestFlipkart = sortedFlipkart[0]?.price || Infinity;

  return (
    <section className="compare-section">
      <h2 className="compare-title">
        <span>📊</span>
        Price Comparison - Best Deals
      </h2>

      <div className="compare-grid">
        {/* Amazon Column */}
        <div className="compare-column">
          <div className="compare-column-header amazon">
            <div className="compare-logo amazon">A</div>
            <div>
              <h3 className="compare-column-title">Amazon</h3>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                Top {sortedAmazon.length} lowest prices
              </span>
            </div>
          </div>

          {sortedAmazon.length > 0 ? (
            sortedAmazon.map((product, index) => (
              <a
                key={index}
                href={product.link}
                target="_blank"
                rel="noopener noreferrer"
                className="compare-item"
                style={{ textDecoration: 'none' }}
              >
                <img
                  src={product.image || 'https://via.placeholder.com/60x60'}
                  alt={product.title}
                  className="compare-item-image"
                />
                <div className="compare-item-details">
                  <p className="compare-item-title">{product.title}</p>
                  <p className={`compare-item-price ${product.price <= lowestFlipkart ? 'lowest' : ''}`}>
                    ₹{product.price.toLocaleString()}
                    {product.price < lowestFlipkart && (
                      <span style={{
                        marginLeft: '0.5rem',
                        fontSize: '0.75rem',
                        color: 'var(--accent-green)',
                        background: 'rgba(0, 217, 126, 0.1)',
                        padding: '0.2rem 0.5rem',
                        borderRadius: '4px'
                      }}>
                        Best Price! 🎉
                      </span>
                    )}
                  </p>
                </div>
              </a>
            ))
          ) : (
            <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '2rem' }}>
              No Amazon products found
            </p>
          )}
        </div>

        {/* Flipkart Column */}
        <div className="compare-column">
          <div className="compare-column-header flipkart">
            <div className="compare-logo flipkart">F</div>
            <div>
              <h3 className="compare-column-title">Flipkart</h3>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                Top {sortedFlipkart.length} lowest prices
              </span>
            </div>
          </div>

          {sortedFlipkart.length > 0 ? (
            sortedFlipkart.map((product, index) => (
              <a
                key={index}
                href={product.link}
                target="_blank"
                rel="noopener noreferrer"
                className="compare-item"
                style={{ textDecoration: 'none' }}
              >
                <img
                  src={product.image || 'https://via.placeholder.com/60x60'}
                  alt={product.title}
                  className="compare-item-image"
                />
                <div className="compare-item-details">
                  <p className="compare-item-title">{product.title}</p>
                  <p className={`compare-item-price ${product.price <= lowestAmazon ? 'lowest' : ''}`}>
                    ₹{product.price.toLocaleString()}
                    {product.price < lowestAmazon && (
                      <span style={{
                        marginLeft: '0.5rem',
                        fontSize: '0.75rem',
                        color: 'var(--accent-green)',
                        background: 'rgba(0, 217, 126, 0.1)',
                        padding: '0.2rem 0.5rem',
                        borderRadius: '4px'
                      }}>
                        Best Price! 🎉
                      </span>
                    )}
                  </p>
                </div>
              </a>
            ))
          ) : (
            <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '2rem' }}>
              No Flipkart products found
            </p>
          )}
        </div>
      </div>
    </section>
  );
}

export default App;
