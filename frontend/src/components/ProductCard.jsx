import { memo } from "react";

/**
 * ProductCard — A reusable card component for displaying a single product.
 * Wrapped in React.memo to skip re-renders when props haven't changed.
 *
 * Props:
 *  - product: { id, name, category, price, description, tags }
 */
const ProductCard = memo(({ product }) => {
    return (
        <div className="product-card" id={`product-${product.id}`}>
            <span className="product-card__category">{product.category}</span>
            <h3 className="product-card__name">{product.name}</h3>
            <p className="product-card__description">{product.description}</p>
            <div className="product-card__footer">
                <span className="product-card__price">₹{product.price.toLocaleString("en-IN")}</span>
                <div className="product-card__tags">
                    {product.tags.slice(0, 3).map((tag) => (
                        <span key={tag} className="product-card__tag">
                            {tag}
                        </span>
                    ))}
                </div>
            </div>
        </div>
    );
});

ProductCard.displayName = "ProductCard";

export default ProductCard;
