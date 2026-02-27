import { useState, useEffect, useMemo, useCallback } from "react";
import ProductCard from "./ProductCard";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

/**
 * ProductList — Fetches and displays the product catalog from the backend.
 * Supports category filtering and displays loading/error/empty states.
 *
 * Props:
 *  - overrideProducts: optional array of products to display (from AI results)
 *  - overrideTitle: optional title string when showing AI results
 */
const ProductList = ({ overrideProducts, overrideTitle }) => {
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [activeCategory, setActiveCategory] = useState("All");

    // Fetch all products on mount
    useEffect(() => {
        const fetchProducts = async () => {
            try {
                setLoading(true);
                setError(null);
                const res = await fetch(`${API_URL}/api/products`);
                if (!res.ok) throw new Error("Failed to fetch products");
                const data = await res.json();
                setProducts(data);
            } catch (err) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };

        fetchProducts();
    }, []);

    // If override products are provided (from AI search), display those
    const displayProducts = overrideProducts || products;

    // Optimization: Memoize categories so they're only recomputed when products change
    const categories = useMemo(() => [
        "All",
        ...new Set(products.map((p) => p.category)),
    ], [products]);

    // Optimization: Memoize filtered products to avoid recomputation
    const filteredProducts = useMemo(() => {
        if (overrideProducts) return overrideProducts;
        if (activeCategory === "All") return products;
        return products.filter((p) => p.category === activeCategory);
    }, [overrideProducts, products, activeCategory]);

    if (loading) {
        return (
            <div className="loading" id="products-loading">
                <div className="loading__spinner"></div>
                <p className="loading__text">Loading products...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="error-msg" id="products-error">
                ⚠️ {error}. Make sure the backend server is running on port 5000.
            </div>
        );
    }

    return (
        <section className="products-section" id="products-section">
            <div className="products-section__header">
                <h2 className="products-section__title">
                    📦 {overrideTitle || "Product Catalog"}
                    <span className="products-section__count">
                        ({filteredProducts.length} product
                        {filteredProducts.length !== 1 ? "s" : ""})
                    </span>
                </h2>

                {/* Category filters — only shown for full catalog */}
                {!overrideProducts && (
                    <div className="category-filters" id="category-filters">
                        {categories.map((cat) => (
                            <button
                                key={cat}
                                className={`category-btn ${activeCategory === cat ? "category-btn--active" : ""
                                    }`}
                                onClick={() => setActiveCategory(cat)}
                            >
                                {cat}
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {filteredProducts.length === 0 ? (
                <div className="empty-state">
                    <div className="empty-state__icon">🔍</div>
                    <p className="empty-state__text">
                        No products found. Try a different category or search query.
                    </p>
                </div>
            ) : (
                <div className="product-grid" id="product-grid">
                    {filteredProducts.map((product) => (
                        <ProductCard key={product.id} product={product} />
                    ))}
                </div>
            )}
        </section>
    );
};

export default ProductList;
