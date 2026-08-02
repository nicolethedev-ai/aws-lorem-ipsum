import os
from pathlib import Path

from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from openai import OpenAI
from pydantic import BaseModel, Field

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)

class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=1200)

# Place your own email
EMAIL = "test@example.com"

# Place your own context
PORTFOLIO_CONTEXT = """
"""

CHAT_SYSTEM_PROMPT = f"""
You are a portfolio chatbot, your name is 'matcha.assist'. Answer questions using only provided context.
Be concise, helpful, and reply in the user's language. If the answer is not in the context, say you do not know and suggest emailing {EMAIL}.

{PORTFOLIO_CONTEXT}
"""


def openai_client() -> OpenAI:
    return OpenAI(base_url=os.getenv("OPENAI_BASE_URL"))


def stream_chat(messages):
    client = openai_client()
    stream = client.chat.completions.create(
        model=os.getenv("OPENAI_MODEL"),
        messages=messages,
        stream=True,
    )

    def event_stream():
        for chunk in stream:
            text = chunk.choices[0].delta.content
            if not text:
                continue
            lines = text.split("\n")
            for line in lines[:-1]:
                yield f"data: {line}\n\n"
                yield "data:  \n"
            yield f"data: {lines[-1]}\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream")


def portfolio_fallback(message: str) -> str:
    text = message.lower()
    return f"Please contact to {EMAIL}."

def text_stream(text: str):
    def event_stream():
        yield f"data: {text}\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream")


@app.post("/api/chat")
def portfolio_chat(request: ChatRequest):
    message = request.message.strip()
    if not message:
        raise HTTPException(status_code=400, detail="Message is required")
    if not os.getenv("OPENAI_API_KEY"):
        return text_stream(portfolio_fallback(message))
    try:
        return stream_chat(
            [
                {"role": "system", "content": CHAT_SYSTEM_PROMPT},
                {"role": "user", "content": message},
            ]
        )
    except Exception:
        return text_stream(portfolio_fallback(message))


@app.get("/health")
def health_check():
    return {"status": "healthy"}


# @app.get("/profile.pdf")
# def profile_pdf():
#     return FileResponse(Path("documents/Profile.pdf"), media_type="application/pdf")


static_path = Path("static")
if static_path.exists():
    @app.get("/")
    def serve_root():
        return FileResponse(static_path / "index.html", media_type="text/html")

    app.mount("/", StaticFiles(directory=static_path, html=True), name="static")
