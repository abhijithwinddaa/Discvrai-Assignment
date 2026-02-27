# Discvrai — AI-Powered Product Discovery

A full-stack product discovery system with AI/LLM integration. Users can browse products and ask natural-language questions like *"Show me budget laptops"* or *"What's good for gaming?"* — the AI returns matching products with a summary.

## 🛠️ Tech Stack

| Layer     | Technology                     |
|-----------|-------------------------------|
| Backend   | Node.js, Express              |
| Frontend  | React (Vite)                  |
| AI/LLM    | Groq (Llama 3.3 70B)          |
| Styling   | Vanilla CSS (custom design)   |

## 📁 Project Structure

```
/product-discovery
├── backend/
│   ├── server.js            # Express API server
│   ├── data/
│   │   └── products.json    # Mock product catalog (8 products)
│   ├── .env                 # API keys (not committed)
│   ├── .env.example         # Template for env vars
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── App.jsx          # Root component
│   │   ├── main.jsx         # Entry point
│   │   ├── index.css        # Global styles & design system
│   │   └── components/
│   │       ├── ProductCard.jsx   # Reusable product card
│   │       ├── ProductList.jsx   # Product listing with filters
│   │       └── AskQuery.jsx      # AI search interface
│   ├── index.html
│   └── package.json
└── README.md
```

## 🚀 How to Run

### Prerequisites
- Node.js (v18+)
- A Groq API key ([Get one free here](https://console.groq.com/keys))

### 1. Setup Backend

```bash
cd backend
npm install

# Create .env file with your Groq key
cp .env.example .env
# Edit .env and add your GROQ_API_KEY

# Start the server
node server.js
```

The backend runs on **http://localhost:5000**

> **Note:** The app works without an API key using keyword-based fallback, but AI features require a valid Groq API key.

### 2. Setup Frontend

```bash
cd frontend
npm install
npm run dev
```

The frontend runs on **http://localhost:5173**

### 3. Use the App

1. Open **http://localhost:5173** in your browser
2. Browse the product catalog (8 products across 4 categories)
3. Use category filter buttons to narrow down products
4. Type a natural-language query in the AI search box (e.g., *"What's good for gaming?"*)
5. Click **"Ask AI"** — see AI-recommended products and a summary

## 🔌 API Endpoints

| Method | Endpoint         | Description                                    |
|--------|------------------|------------------------------------------------|
| GET    | `/api/products`  | List all products. Supports `?category=` and `?search=` query params |
| POST   | `/api/ask`       | AI-powered query. Body: `{ "query": "..." }`. Returns `{ productIds, summary, products }` |
| GET    | `/api/health`    | Health check. Shows LLM status and product count |

## 🤖 AI/LLM Integration

### How It Works
1. User types a natural-language question
2. Frontend sends `POST /api/ask` with `{ "query": "..." }`
3. Backend builds a **prompt** containing:
   - The user's query
   - Full product catalog context (names, categories, prices, descriptions, tags)
4. **Groq Llama 3.3 70B** processes the prompt and returns:
   - `productIds` — array of matching product IDs
   - `summary` — short explanation of why these products match
5. Backend **validates** IDs against the catalog and returns structured JSON
6. Frontend displays the AI summary + filtered product cards

### Prompt Design
The system prompt instructs the LLM to:
- Only return products from the provided catalog
- Return a consistent JSON shape: `{ "productIds": [...], "summary": "..." }`
- Be concise and helpful in summaries

### Error Handling
- **Rate limits (429):** Returns 503 with user-friendly message
- **Auth failures (401):** Returns 503 with config check message
- **Parse failures:** Falls back to raw text summary
- **No API key:** Uses keyword-based fallback matching

## ⏱️ Time Spent

~3 hours (backend + LLM integration, frontend + styling, testing)

## 📝 Environment Variables

| Variable         | Description                | Required |
|-----------------|----------------------------|----------|
| `GROQ_API_KEY`   | Groq API key               | Yes (for AI features) |
| `PORT`           | Backend server port        | No (default: 5000) |
