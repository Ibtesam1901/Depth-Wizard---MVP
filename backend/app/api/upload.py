from fastapi import APIRouter, UploadFile, File, HTTPException
import os
import shutil
import base64
import io
from PIL import Image
from ..geospatial.metadata import extract_geospatial_metadata
from ..geospatial.geotiff import read_geotiff_as_rgb

router = APIRouter(prefix="/api", tags=["upload"])

TEMP_DIR = "temp_uploads"
os.makedirs(TEMP_DIR, exist_ok=True)

@router.post("/upload")
async def upload_file(file: UploadFile = File(...)):
    """
    Ingests an imagery file (.jpg, .png, .tif, .tiff, .h5).
    Extracts geospatial metadata and returns image characteristics.
    """
    ext = os.path.splitext(file.filename)[1].lower()
    allowed_exts = [".jpg", ".jpeg", ".png", ".tif", ".tiff", ".h5"]
    
    if ext not in allowed_exts:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file format '{ext}'. Supported formats: JPG, PNG, GeoTIFF, HDF5."
        )

    file_id = f"upload_{os.urandom(6).hex()}_{file.filename}"
    temp_path = os.path.join(TEMP_DIR, file_id)

    with open(temp_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    try:
        metadata = extract_geospatial_metadata(temp_path)
        
        # Generate preview base64
        if ext in [".tif", ".tiff"]:
            pil_img, _, _ = read_geotiff_as_rgb(temp_path)
        else:
            pil_img = Image.open(temp_path).convert("RGB")

        # Create compact preview thumbnail for UI
        preview_img = pil_img.copy()
        preview_img.thumbnail((384, 384))
        buf = io.BytesIO()
        preview_img.save(buf, format="JPEG", quality=85)
        preview_b64 = base64.b64encode(buf.getvalue()).decode("utf-8")

        return {
            "file_id": file_id,
            "filename": file.filename,
            "metadata": metadata,
            "preview_base64": preview_b64,
            "original_width": pil_img.width,
            "original_height": pil_img.height,
        }
    except Exception as e:
        if os.path.exists(temp_path):
            os.remove(temp_path)
        raise HTTPException(status_code=500, detail=f"Failed to process imagery: {str(e)}")
