import os
from fastapi import FastAPI, File, Header, HTTPException, UploadFile
from fastapi.responses import Response
from rembg import remove

app = FastAPI(title="Rejected Treasures Background Worker", version="1.0.0")


def authorize(authorization: str | None) -> None:
    expected = os.getenv("BACKGROUND_REMOVAL_API_TOKEN", "").strip()
    if expected and authorization != f"Bearer {expected}":
        raise HTTPException(status_code=401, detail="Unauthorized")


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/remove")
async def remove_background(
    file: UploadFile = File(...), authorization: str | None = Header(default=None)
) -> Response:
    authorize(authorization)
    if file.content_type not in {"image/jpeg", "image/png", "image/webp"}:
        raise HTTPException(status_code=415, detail="Send a JPEG, PNG, or WebP preview")
    source = await file.read()
    if not source or len(source) > 12 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="Image is empty or too large")
    result = remove(source, alpha_matting=True)
    return Response(content=result, media_type="image/png")
