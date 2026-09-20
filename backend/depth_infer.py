from transformers import pipeline
from PIL import Image
import numpy as np

depth_pipe = pipeline(
    task="depth-estimation",
    model="depth-anything/Depth-Anything-V2-Small-hf"
)

def get_relative_depth(image_path: str) -> np.ndarray:
    image = Image.open(image_path).convert("RGB")
    result = depth_pipe(image)
    depth = np.array(result["depth"])          # relative depth, arbitrary units
    depth_norm = (depth - depth.min()) / (depth.max() - depth.min() + 1e-8)
    return depth_norm
