import { useState } from "react";
import AskQuery from "./components/AskQuery";
import ProductList from "./components/ProductList";
import "./index.css";

/**
 * App — Root component for the Discvrai Product Discovery system.
 *
 * State flow:
 * 1. On load: ProductList fetches and shows all products from the backend
 * 2. When user asks a question: AskQuery calls POST /api/ask and passes results up
 * 3. ProductList then shows only the AI-matched products
 * 4. User can click "Back to all products" to reset
 */
function App() {
  const [aiProducts, setAiProducts] = useState(null);
  const [aiTitle, setAiTitle] = useState("");

  const handleAiResults = (data) => {
    if (data.products && data.products.length > 0) {
      setAiProducts(data.products);
      setAiTitle("AI Recommended Products");
    } else {
      setAiProducts([]);
      setAiTitle("No Matching Products");
    }
  };

  const handleClearResults = () => {
    setAiProducts(null);
    setAiTitle("");
  };

  return (
    <div className="app" id="app">
      {/* ─── Header ─── */}
      <header className="app-header">
        <h1 className="app-header__logo">Discvrai</h1>
        <p className="app-header__tagline">
          AI-Powered Product Discovery — Find exactly what you need
        </p>
      </header>

      {/* ─── AI Ask Section ─── */}
      <AskQuery onResults={handleAiResults} onClear={handleClearResults} />

      {/* ─── Product Listing ─── */}
      <ProductList
        overrideProducts={aiProducts}
        overrideTitle={aiTitle}
      />
    </div>
  );
}

export default App;
