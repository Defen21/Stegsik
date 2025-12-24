from worker import analyze_image_task, celery_app
from utils import patch_png_height, patch_jpg_height, process_image_encryption
from celery.result import AsyncResult
import shutil
import os
import uuid
import magic  # python-magic-bin
from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Request, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

# Infrastructure Setup
limiter = Limiter(key_func=get_remote_address)
app = FastAPI()
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# Security Constants
MAX_IMAGE_SIZE = 50 * 1024 * 1024      # 50MB
MAX_PAYLOAD_SIZE = 1 * 1024 * 1024 * 1024  # 1GB
ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png']

# Middleware: Strict CORS & Security Headers
origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:3000",
    "http://127.0.0.1:3000"
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)

@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    return response

# Validation Helper
async def validate_file(file: UploadFile, max_size: int = MAX_IMAGE_SIZE, allowed_mimes: list = ALLOWED_IMAGE_TYPES):
    # 1. Check Magic Numbers (Mime Type) for images
    # If allowed_mimes is None or empty, we skip mime check (e.g. for generic payloads)
    if allowed_mimes:
        header = await file.read(2048)
        await file.seek(0)
        
        mime = magic.from_buffer(header, mime=True)
        if mime not in allowed_mimes:
            raise HTTPException(status_code=400, detail=f"Invalid file type: {mime}. Allowed: {allowed_mimes}")
    
    return True

async def save_upload_file(file: UploadFile, file_location: str, max_size: int):
    total_size = 0
    with open(file_location, "wb+") as file_object:
        while chunk := await file.read(1024 * 1024): # 1MB chunks
            total_size += len(chunk)
            if total_size > max_size:
                file_object.close()
                os.remove(file_location)
                raise HTTPException(status_code=413, detail=f"File too large. Max allowed: {max_size/1024/1024} MB")
            file_object.write(chunk)
    await file.seek(0) # Reset if needed, though usually we are done reading.

UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

# Mount the uploads directory to be accessible via /uploads
app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")

@app.post("/upload")
@limiter.limit("50/minute")
async def upload_image(request: Request, file: UploadFile = File(...)):
    await validate_file(file, max_size=MAX_IMAGE_SIZE, allowed_mimes=ALLOWED_IMAGE_TYPES)
    
    file_id = str(uuid.uuid4())
    file_location = f"{UPLOAD_DIR}/{file_id}_{file.filename}"
    
    await save_upload_file(file, file_location, max_size=MAX_IMAGE_SIZE)
    
    task = analyze_image_task.delay(file_location)
    return {"task_id": task.id, "filename": file.filename}

@app.post("/patch-height")
@limiter.limit("20/minute")
async def patch_height(request: Request, file: UploadFile = File(...), height: int = Form(...)):
    await validate_file(file, max_size=MAX_IMAGE_SIZE, allowed_mimes=ALLOWED_IMAGE_TYPES)
    file_id = str(uuid.uuid4())
    # Save original
    original_filename = file.filename
    file_location = f"{UPLOAD_DIR}/{file_id}_{original_filename}"
    
    await save_upload_file(file, file_location, max_size=MAX_IMAGE_SIZE)
        
    # Determine type and patch
    ext = os.path.splitext(original_filename)[1].lower()
    success = False
    msg = ""
    
    if ext == '.png':
        success, msg = patch_png_height(file_location, height)
    elif ext in ['.jpg', '.jpeg']:
        success, msg = patch_jpg_height(file_location, height)
    else:
        return {"status": "error", "message": "Unsupported file format. Only PNG and JPG supported."}
        
    if success:
        # We modified the file in place.
        # Return download URL
        return {
            "status": "success", 
            "message": msg,
            "download_url": f"uploads/{file_id}_{original_filename}"
        }
    else:
        return {"status": "error", "message": f"Patch failed: {msg}"}

@app.post("/encrypt")
@limiter.limit("20/minute")
async def encrypt_image(request: Request, file: UploadFile = File(...), password: str = Form(...)):
    await validate_file(file, max_size=MAX_IMAGE_SIZE, allowed_mimes=ALLOWED_IMAGE_TYPES)
    try:
        file_id = str(uuid.uuid4())
        original_filename = file.filename
        file_location = f"{UPLOAD_DIR}/{file_id}_{original_filename}"
        
        await save_upload_file(file, file_location, max_size=MAX_IMAGE_SIZE)
            
        success, out_filename, out_path = process_image_encryption(file_location, password, mode='encrypt')
        
        if success:
            return {
                "status": "success",
                "message": "Image Encrypted Successfully",
                "download_url": f"uploads/{out_filename}",
                "filename": out_filename
            }
        else:
            return {"status": "error", "message": f"Encryption failed: {out_filename}"}
    except Exception as e:
        return {"status": "error", "message": f"Server Error: {str(e)}"}

@app.post("/decrypt")
@limiter.limit("20/minute")
async def decrypt_image(request: Request, file: UploadFile = File(...), password: str = Form(...)):
    await validate_file(file, max_size=MAX_IMAGE_SIZE, allowed_mimes=ALLOWED_IMAGE_TYPES)
    try:
        file_id = str(uuid.uuid4())
        original_filename = file.filename
        file_location = f"{UPLOAD_DIR}/{file_id}_{original_filename}"
        
        await save_upload_file(file, file_location, max_size=MAX_IMAGE_SIZE)
            
        success, out_filename, out_path = process_image_encryption(file_location, password, mode='decrypt')
        
        if success:
            return {
                "status": "success",
                "message": "Image Decrypted Successfully",
                "download_url": f"uploads/{out_filename}",
                "filename": out_filename
            }
        else:
            return {"status": "error", "message": f"Decryption failed: {out_filename}"}
    except Exception as e:
        return {"status": "error", "message": f"Server Error: {str(e)}"}

@app.post("/embed")
@limiter.limit("20/minute")
async def embed_file(
    request: Request,
    cover: UploadFile = File(...),
    payload_file: UploadFile = File(None),
    payload_text: str = Form(None)
):
    # Validate Cover (Image, 50MB)
    await validate_file(cover, max_size=MAX_IMAGE_SIZE, allowed_mimes=ALLOWED_IMAGE_TYPES)
    
    # Validate Payload (Any, 1GB)
    if payload_file:
        await validate_file(payload_file, max_size=MAX_PAYLOAD_SIZE, allowed_mimes=[])

    try:
        file_id = str(uuid.uuid4())
        cover_filename = cover.filename
        cover_location = f"{UPLOAD_DIR}/{file_id}_{cover_filename}"
        
        # Save cover image
        await save_upload_file(cover, cover_location, max_size=MAX_IMAGE_SIZE)
            
        # Determine payload
        payload_bytes = b""
        if payload_file:
            payload_bytes = await payload_file.read()
        elif payload_text:
            payload_bytes = payload_text.encode('utf-8')
        else:
            return {"status": "error", "message": "No payload provided (file or text)"}
            
        # Generate output filename
        name, ext = os.path.splitext(cover_filename)
        out_filename = f"embedded_{file_id}_{name}{ext}"
        out_path = f"{UPLOAD_DIR}/{out_filename}"
        
        # Embed
        # Embed
        from utils import embed_data
        success, msg = embed_data(cover_location, payload_bytes, out_path)
        
        if success:
            return {
                "status": "success",
                "message": f"Data embedded. Size increased by {len(payload_bytes)} bytes.",
                "download_url": f"uploads/{out_filename}",
                "filename": out_filename
            }
        else:
             return {"status": "error", "message": f"Embedding failed: {msg}"}

    except Exception as e:
        return {"status": "error", "message": str(e)}

@app.post("/extract")
@limiter.limit("20/minute")
async def extract_file(
    request: Request,
    file: UploadFile = File(...)
):
    await validate_file(file, max_size=MAX_IMAGE_SIZE, allowed_mimes=ALLOWED_IMAGE_TYPES)
    
    try:
        file_id = str(uuid.uuid4())
        original_filename = file.filename
        file_location = f"{UPLOAD_DIR}/{file_id}_{original_filename}"
        
        await save_upload_file(file, file_location, max_size=MAX_IMAGE_SIZE)
        
        from utils import extract_overlay
        overlay_data = extract_overlay(file_location)
        
        if overlay_data:
            # Result is bytes (extracted content)
            # Save to a file to allow download
            out_filename = f"extracted_{file_id}.bin" # Generic bin
            
            out_path = f"{UPLOAD_DIR}/{out_filename}"
            with open(out_path, 'wb') as f:
                f.write(overlay_data)
                
            return {
                "status": "success",
                "message": "Data extracted successfully.",
                "download_url": f"uploads/{out_filename}",
                "filename": out_filename
            }
        else:
            return {"status": "error", "message": f"Extraction failed: {result}"}
            
    except Exception as e:
        return {"status": "error", "message": f"Server Error: {str(e)}"}

@app.get("/result/{task_id}")
async def get_result(task_id: str):
    task_result = AsyncResult(task_id, app=celery_app)
    if task_result.ready():
        return {"status": "completed", "result": task_result.result}
    return {"status": "processing"}

from fastapi.responses import FileResponse

@app.get("/download/{file_path:path}")
async def download_file(file_path: str):
    # Security check: prevent directory traversal
    if ".." in file_path:
            raise HTTPException(status_code=400, detail="Invalid path")
    
    full_path = os.path.join(UPLOAD_DIR, file_path)
    if not os.path.exists(full_path):
            raise HTTPException(status_code=404, detail="File not found")
    
    # Force download with attachment
    return FileResponse(full_path, media_type='application/octet-stream', filename=os.path.basename(file_path))

# --- ADVANCED STEGANOGRAPHY ENDPOINTS ---
from advanced_steg import custom_inject, solve_custom_steg, DEFAULT_INTERVAL, DEFAULT_START_OFFSET

@app.post("/steg/advanced/hide")
@limiter.limit("10/minute")
async def advanced_hide(
    request: Request,
    file: UploadFile = File(...),
    message: str = Form(...),
    start_offset: int = Form(None),
    interval: int = Form(None)
):
    await validate_file(file, max_size=MAX_IMAGE_SIZE, allowed_mimes=ALLOWED_IMAGE_TYPES)
    try:
        file_id = str(uuid.uuid4())
        original_filename = file.filename
        file_location = f"{UPLOAD_DIR}/{file_id}_{original_filename}"
        
        # Read original data (Manually due to need for bytes later for helper?) 
        # Actually our helper uses file path, but this endpoint reads bytes directly at line 187 (original code)
        # Let's see... line 241 original says `original_data = await file.read()`.
        # We should use save_upload_file then read back if we want to enforce size strictly via stream,
        # OR just read with size check.
        # Since we need to save anyway or process bytes? 
        # The original code:
        # file_location = ...
        # original_data = await file.read() 
        # ... logic ...
        # The file is NOT saved to disk in original code? 
        # Wait, line 214 writes `final_data` to `out_location`. 
        # It seems `file_location` variable was unused in original code for reading!
        # Ah, looking at original code:
        # file_location = f"{UPLOAD_DIR}/{file_id}_{original_filename}"
        # original_data = await file.read()
        # It never saved the input file to disk!
        # So for size limit, we should just read with limit.
        
        # Custom Size Limit Read
        original_data = await file.read()
        if len(original_data) > MAX_IMAGE_SIZE:
             raise HTTPException(status_code=413, detail=f"File too large. Max allowed: {MAX_IMAGE_SIZE/1024/1024} MB")

        # Determine Keys (Manual or Random)
        import random
        
        if start_offset is not None and interval is not None:
            # Use Manual Keys
            offset = start_offset
            interval_val = interval
            is_random = False
        else:
            # Generate Random Keys
            offset = random.randint(500, 3000)
            interval_val = random.randint(10, 100)
            is_random = True
            
        # Process Injection
        # Note: custom_inject returns binary data (bytes)
        final_data = custom_inject(original_data, message, offset, interval_val)
        
        # Save Modified File
        # We'll save it with a modified name
        name, ext = os.path.splitext(original_filename)
        out_filename = f"advanced_steg_{file_id}{ext}"
        out_location = f"{UPLOAD_DIR}/{out_filename}"
        
        with open(out_location, "wb") as f:
            f.write(final_data)
            
        return {
            "status": "success",
            "message": "Message hidden successfully. SAVE YOUR KEYS!",
                "download_url": f"uploads/{out_filename}",
                "filename": out_filename,
                "key_offset": offset,
                "key_interval": interval_val,
                "is_random": is_random
            }
    except Exception as e:
        return {"status": "error", "message": f"Hiding failed: {str(e)}"}

@app.post("/steg/advanced/recover")
@limiter.limit("20/minute")
async def advanced_recover(
    request: Request,
    file: UploadFile = File(...),
    offset: int = Form(DEFAULT_START_OFFSET),
    interval: int = Form(DEFAULT_INTERVAL)
):
    await validate_file(file, max_size=MAX_IMAGE_SIZE, allowed_mimes=ALLOWED_IMAGE_TYPES)
    try:
        # Read file data directly
        data = await file.read()
        if len(data) > MAX_IMAGE_SIZE:
             raise HTTPException(status_code=413, detail=f"File too large. Max allowed: {MAX_IMAGE_SIZE/1024/1024} MB")
        
        # Solve/Recover
        recovered_message = solve_custom_steg(data, offset, interval)
        
        if recovered_message.startswith("Error:"):
             return {"status": "error", "message": recovered_message}

        return {
            "status": "success",
            "message": "Message recovered successfully.",
            "recovered_text": recovered_message
        }
    except Exception as e:
         return {"status": "error", "message": f"Recovery failed: {str(e)}"}


@app.get("/")
def read_root():
    return {"message": "Stegsik Backend is running"}
