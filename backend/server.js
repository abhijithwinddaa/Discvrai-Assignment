const express = require("express");
const cors = require("cors");
const compression = require("compression");
const dotenv = require("dotenv");
const OpenAI = require("openai");
const products = require("./data/products.json");

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(compression());  // Gzip compression for all responses
app.use(express.json());

// ─── Optimization: Pre-compute search index ─────────────────────────────────
// Avoids repeated .toLowerCase() calls on every request
const searchIndex = products.map((p) => ({
  ...p,
  _searchText: `${p.name} ${p.category} ${p.description} ${p.tags.join(" ")}`.toLowerCase(),
  _categoryLower: p.category.toLowerCase(),
}));

// ─── Optimization: LLM response cache (5-min TTL) ──────────────────────────
// Prevents duplicate API calls for identical queries
const llmCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// ─── Optimization: Normalize queries ────────────────────────────────────────
// Strip trailing punctuation so "gaming?" and "gaming" produce identical results
function normalizeQuery(query) {
  return query
    .toLowerCase()
    .trim()
    .replace(/[?!.,;:]+$/g, "")   // strip trailing punctuation
    .replace(/\s+/g, " ");         // collapse multiple spaces
}

function getCachedResponse(query) {
  const key = normalizeQuery(query);
  const cached = llmCache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) return cached.data;
  llmCache.delete(key);
  return null;
}

function setCachedResponse(query, data) {
  const key = normalizeQuery(query);
  llmCache.set(key, { data, timestamp: Date.now() });
  // Evict old entries if cache grows too large
  if (llmCache.size > 100) {
    const oldest = llmCache.keys().next().value;
    llmCache.delete(oldest);
  }
}

// ─── Initialize Groq LLM client (OpenAI-compatible) ────────────────────────
const groqApiKey = process.env.GROQ_API_KEY;
const llmClient = groqApiKey
  ? new OpenAI({
    apiKey: groqApiKey,
    baseURL: "https://api.groq.com/openai/v1",
  })
  : null;

// ─── GET /api/products ──────────────────────────────────────────────────────
// Returns all products, with optional ?category= and ?search= query params
app.get("/api/products", (req, res) => {
  try {
    let filtered = searchIndex;

    // Filter by category using pre-computed lowercase
    if (req.query.category) {
      const cat = req.query.category.toLowerCase();
      filtered = filtered.filter((p) => p._categoryLower === cat);
    }

    // Filter by search keyword using pre-computed search text
    if (req.query.search) {
      const term = req.query.search.toLowerCase();
      filtered = filtered.filter((p) => p._searchText.includes(term));
    }

    // Strip internal search fields before sending
    const result = filtered.map(({ _searchText, _categoryLower, ...p }) => p);

    // Cache headers for static product data
    res.set("Cache-Control", "public, max-age=60");
    res.json(result);
  } catch (error) {
    console.error("Error fetching products:", error);
    res.status(500).json({ error: "Failed to fetch products" });
  }
});

// ─── POST /api/ask ──────────────────────────────────────────────────────────
// Accepts { "query": "user's natural language" }
// Calls LLM with product context, returns { productIds, summary }
app.post("/api/ask", async (req, res) => {
  try {
    const { query } = req.body;

    if (!query || typeof query !== "string" || query.trim().length === 0) {
      return res.status(400).json({ error: "A non-empty 'query' field is required." });
    }

    // ── Optimization: Check cache first ──
    const cached = getCachedResponse(query);
    if (cached) {
      return res.json(cached);
    }

    // Build product context for the LLM
    const productContext = products
      .map(
        (p) =>
          `- ${p.id}: "${p.name}" | Category: ${p.category} | Price: ₹${p.price.toLocaleString("en-IN")} | ${p.description} | Tags: ${p.tags.join(", ")}`
      )
      .join("\n");

    const systemPrompt = `You are an expert product discovery assistant for an Indian e-commerce store. All prices are in Indian Rupees (₹).

HERE IS THE COMPLETE PRODUCT CATALOG:
${productContext}

YOUR TASK: Analyze the user's query and return the most relevant products from the catalog above.

MATCHING RULES:
1. **Budget queries** (e.g. "under ₹10,000", "below 20000", "cheapest"): Filter products strictly by price. Only include products that actually fall within the stated budget. Compare numeric values carefully.
2. **Use-case queries** (e.g. "for gaming", "home office", "fitness"): Match products whose description, tags, or name relate to the use case. Think about what products someone would actually need for that activity.
3. **Category queries** (e.g. "accessories", "electronics"): Match by category field.
4. **Conversational queries** (e.g. "birthday gift", "entertainment room"): Think about what products would genuinely fit the scenario described. Consider price appropriateness for gifts.
5. **Combined queries** (e.g. "gaming under ₹50,000"): Apply ALL filters together — both use-case AND budget must match.

RESPONSE FORMAT — Return ONLY this JSON, nothing else:
{
  "productIds": ["P001", "P002"],
  "summary": "A helpful 1-3 sentence explanation in natural language about why these products match, mentioning prices in ₹."
}

CRITICAL RULES:
- ONLY use product IDs from the catalog above (P001-P008).
- For budget queries, NEVER include products that exceed the stated budget.
- If no products match, return {"productIds": [], "summary": "explanation of why nothing matched"}.
- Always mention specific prices in ₹ in your summary.
- Return ONLY valid JSON. No markdown, no code blocks, no extra text.`;

    // ── If Groq LLM is configured, call the API ──
    if (llmClient) {
      const completion = await llmClient.chat.completions.create({
        model: "llama-3.3-70b-versatile",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: query },
        ],
        temperature: 0,
        max_tokens: 400,
        response_format: { type: "json_object" },
      });

      const raw = completion.choices[0].message.content.trim();

      // Parse the LLM response as JSON
      let parsed;
      try {
        parsed = JSON.parse(raw);
      } catch {
        // If JSON parsing fails, try extracting JSON from the response
        const jsonMatch = raw.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          parsed = JSON.parse(jsonMatch[0]);
        } else {
          parsed = { productIds: [], summary: raw };
        }
      }

      // Validate productIds exist in catalog
      const validIds = products.map((p) => p.id);
      parsed.productIds = (parsed.productIds || []).filter((id) =>
        validIds.includes(id)
      );

      // Attach full product objects for convenience
      const matchedProducts = products.filter((p) =>
        parsed.productIds.includes(p.id)
      );

      const result = {
        productIds: parsed.productIds,
        summary: parsed.summary || "",
        products: matchedProducts,
      };
      setCachedResponse(query, result);
      return res.json(result);
    }

    // ── Fallback: keyword-based matching when no API key ──
    const q = query.toLowerCase();
    const matched = products.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q) ||
        p.tags.some((t) => t.toLowerCase().includes(q))
    );

    // Simple keyword splitting for better matching (uses pre-computed search index)
    const words = q.split(/\s+/).filter((w) => w.length > 2);
    const scoredProducts = searchIndex.map((p) => {
      const score = words.reduce(
        (acc, word) => acc + (p._searchText.includes(word) ? 1 : 0),
        0
      );
      return { ...p, score };
    });

    const bestMatches = scoredProducts
      .filter((p) => p.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 4);

    const fallbackResults = bestMatches.length > 0 ? bestMatches : matched.slice(0, 4);

    const fallbackResponse = {
      productIds: fallbackResults.map((p) => p.id),
      summary:
        fallbackResults.length > 0
          ? `Found ${fallbackResults.length} product(s) matching your query. (Note: AI-powered search requires an OpenAI API key for best results.)`
          : "No products matched your query. Try asking about electronics, accessories, or home products.",
      products: fallbackResults.map(({ score, _searchText, _categoryLower, ...p }) => p),
    };
    setCachedResponse(query, fallbackResponse);
    return res.json(fallbackResponse);
  } catch (error) {
    console.error("Error in /api/ask:", error.message);

    // Handle specific OpenAI errors
    if (error?.status === 429) {
      return res.status(503).json({
        error: "AI service is temporarily rate-limited. Please try again in a moment.",
      });
    }
    if (error?.status === 401) {
      return res.status(503).json({
        error: "AI service authentication failed. Please check the API key configuration.",
      });
    }

    return res.status(503).json({
      error: "AI service is temporarily unavailable. Please try again later.",
    });
  }
});

// ─── Health check ───────────────────────────────────────────────────────────
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    llmConfigured: !!llmClient,
    llmProvider: llmClient ? "Groq (Llama 3.3 70B)" : "Fallback (keyword)",
    productCount: products.length,
  });
});

// ─── Start server ───────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🚀 Server running on http://localhost:${PORT}`);
  console.log(`📦 ${products.length} products loaded`);
  console.log(
    `🤖 LLM: ${llmClient ? "Groq (Llama 3.3 70B) ✓" : "Fallback mode (no API key)"}`
  );
  console.log(`\nEndpoints:`);
  console.log(`  GET  /api/products    - List/filter products`);
  console.log(`  POST /api/ask         - AI-powered product query`);
  console.log(`  GET  /api/health      - Health check\n`);
});
