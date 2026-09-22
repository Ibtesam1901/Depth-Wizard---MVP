import os
import gc
import torch
from transformers import pipeline
from PIL import Image
import numpy as np

depth_pipe = None

def get_depth_pipe():
    """Lazy-load the depth pipeline with low memory usage for 512MB cloud free-tiers."""
    global depth_pipe
    if depth_pipe is None:
        depth_pipe = pipeline(
            task="depth-estimation",
            model="depth-anything/Depth-Anything-V2-Small-hf",
            device=-1,  # CPU
            model_kwargs={"low_cpu_mem_usage": True}
        )
    return depth_pipe

def get_relative_depth(image_path: str) -> np.ndarray:
    pipe = get_depth_pipe()
    image = Image.open(image_path).convert("RGB")
    
    with torch.inference_mode():
        result = pipe(image)
        
    depth = np.array(result["depth"], dtype=np.float32)
    depth_norm = (depth - depth.min()) / (depth.max() - depth.min() + 1e-8)
    
    # Force garbage collection to keep RAM safely within 512MB
    gc.collect()
    
    return depth_norm
