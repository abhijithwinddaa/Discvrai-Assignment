import { useState, useCallback } from "react";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

/**
 * AskQuery — AI-powered product search component.
 * Users type a natural-language query, and the backend uses an LLM to
 * return matching products + a summary.
 *
 * Props:
 *  - onResults: callback function that receives the AI results
 *               ({ products, summary, productIds })
 *  - onClear: callback to reset AI results and show full catalog
 */
const AskQuery = ({ onResults, onClear }) => {
    const [query, setQuery] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [summary, setSummary] = useState("");
    const [hasSearched, setHasSearched] = useState(false);

    const handleAsk = async (e) => {
        e.preventDefault();
        if (!query.trim()) return;

        try {
            setLoading(true);
            setError(null);
            setSummary("");

            const res = await fetch(`${API_URL}/api/ask`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ query: query.trim() }),
            });

            if (!res.ok) {
                const errData = await res.json().catch(() => ({}));
                throw new Error(errData.error || `Request failed (${res.status})`);
            }

            const data = await res.json();

            setSummary(data.summary || "");
            setHasSearched(true);

            // Pass results up to parent
            if (onResults) {
                onResults(data);
            }
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleClear = () => {
        setQuery("");
        setSummary("");
        setError(null);
        setHasSearched(false);
        if (onClear) onClear();
    };

    return (
        <section className="ask-section" id="ask-section">
            <div className="ask-card">
                <h2 className="ask-card__title">
                    🤖 Ask AI About Products
                </h2>
                <p className="ask-card__subtitle">
                    Ask anything — "Show me budget smartphones", "What's good for gaming?",
                    "Find me something under ₹10,000"
                </p>

                <form className="ask-form" onSubmit={handleAsk} id="ask-form">
                    <input
                        type="text"
                        className="ask-input"
                        id="ask-input"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="e.g. What are the best products for a home office setup?"
                        disabled={loading}
                    />
                    <button
                        type="submit"
                        className="ask-btn"
                        id="ask-submit-btn"
                        disabled={loading || !query.trim()}
                    >
                        {loading ? (
                            <>
                                <span className="loading__spinner" style={{ width: 18, height: 18, borderWidth: 2 }}></span>
                                Thinking...
                            </>
                        ) : (
                            <>✨ Ask AI</>
                        )}
                    </button>
                </form>

                {/* Error Message */}
                {error && (
                    <div className="error-msg" style={{ marginTop: "1rem" }} id="ask-error">
                        ⚠️ {error}
                    </div>
                )}

                {/* AI Response */}
                {summary && (
                    <div className="ai-response" id="ai-response">
                        <div className="ai-response__summary">
                            <div className="ai-response__label">🧠 AI Summary</div>
                            <p className="ai-response__text">{summary}</p>
                        </div>
                        {hasSearched && (
                            <button
                                className="category-btn"
                                onClick={handleClear}
                                style={{ marginTop: "0.5rem" }}
                                id="clear-search-btn"
                            >
                                ← Back to all products
                            </button>
                        )}
                    </div>
                )}
            </div>
        </section>
    );
};

export default AskQuery;
