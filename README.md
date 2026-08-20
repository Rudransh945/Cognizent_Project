# ProductGenie

ProductGenie is an AI product-comparison assistant for India-localized shopping. It uses natural chat, live Serper Shopping results, Groq reasoning and vision, PDF spec sheets, semantic retrieval, and persistent session history to make grounded recommendations.

The chat deliberately gives compact, conversational answers: one evidence-based pick, up to two alternatives, a clear missing-data warning when needed, and a useful follow-up question. Quick-reply chips support a natural compare-and-refine flow.

## Architecture

```text
React + Vite (localhost:5173)
  ├─ Chat, image and PDF uploads
  └─ Live product cards and comparison table
                  │ HTTP
                  ▼
FastAPI (localhost:8000) ── SQLite (sessions, messages)
                  │
                  ▼
LangGraph intent router
  ├─ search → Serper Shopping (gl=in, hl=en) → MiniLM + FAISS
  ├─ compare/follow-up → session FAISS retrieval → Groq
  ├─ photo → Groq vision → Serper Shopping
  └─ PDF → pdfplumber → MiniLM + FAISS
                  │
                  ▼
Groq response grounded in retrieved products
```

For node-by-node routing detail, see [ARCHITECTURE.md](ARCHITECTURE.md).

## Technology

- Backend: FastAPI, LangGraph, LangChain/Groq, SQLite, Serper, BeautifulSoup, pdfplumber
- Retrieval: `sentence-transformers` (`all-MiniLM-L6-v2`) and FAISS running locally on CPU
- Frontend: React/Vite, Tailwind CSS, Axios, lucide-react

## Setup

The project expects the existing `.venv` and root `.env` file. The only environment variable names required are:

```env
GROQ_API_KEY=
SERPER_API_KEY=
# Optional model overrides:
GROQ_TEXT_MODEL=openai/gpt-oss-120b
GROQ_VISION_MODEL=qwen/qwen3.6-27b
```

Install the backend dependencies into the existing virtual environment:

```powershell
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

Install the frontend dependencies:

```powershell
cd frontend
npm.cmd install
```

## Run

In one terminal at the repository root:

```powershell
.\.venv\Scripts\Activate.ps1
uvicorn main:app --reload --port 8000
```

In another terminal:

```powershell
cd frontend
npm.cmd run dev
```

Open the Vite URL (normally `http://localhost:5173`). FastAPI interactive API documentation is available at `http://localhost:8000/docs`.

## API

| Method | Route | Description |
| --- | --- | --- |
| POST | `/session` | Creates a persistent session and returns `session_id`. |
| POST | `/chat` | Accepts `{session_id, message}` and returns response plus products. |
| POST | `/upload-photo?session_id=…` | Vision-identifies an image, then searches similar products. |
| POST | `/upload-pdf?session_id=…` | Parses a PDF spec sheet and indexes its product data. |
| GET | `/history/{session_id}` | Returns saved user/assistant messages in order. |

All endpoints have Pydantic models and summaries surfaced in Swagger at `/docs`.

## Grounding and limitations

Product facts originate only from Serper results or an uploaded PDF; incomplete fields stay visibly unavailable instead of being invented. The Groq model name defaults can be overridden by environment variables because provider model availability changes. Verify your Groq account's currently enabled vision model with `GET https://api.groq.com/openai/v1/models` before deployment.
