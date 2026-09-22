import os
import gc
import torch
import numpy as np
from PIL import Image
from transformers import pipeline
import cv2

class DepthEstimator:
    """
    Depth Anything V2 Inference Wrapper
    Supports CPU / CUDA inference with adaptive memory management for free-tier constraints.
    Returns both raw unnormalized depth arrays and visualization images.
    """
    _instance = None
    _pipe = None

    def __init__(self, model_name: str = "depth-anything/Depth-Anything-V2-Small-hf"):
        self.model_name = model_name
        self.device = 0 if torch.cuda.is_available() else -1

    @classmethod
    def get_instance(cls):
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    def _load_model(self):
        if self._pipe is None:
            self._pipe = pipeline(
                task="depth-estimation",
                model=self.model_name,
                device=self.device,
                model_kwargs={"low_cpu_mem_usage": True}
            )
        return self._pipe

    def infer(self, image: Image.Image) -> tuple[np.ndarray, np.ndarray]:
        """
        Runs inference on a PIL Image.
        Returns:
            raw_depth: float32 un-normalized depth array (H, W)
            norm_depth: float32 normalized depth array [0, 1] (H, W)
        """
        pipe = self._load_model()
        
        # Ensure RGB
        if image.mode != "RGB":
            image = image.convert("RGB")

        with torch.inference_mode():
            result = pipe(image)

        raw_depth = np.array(result["depth"], dtype=np.float32)
        d_min = float(np.nanmin(raw_depth))
        d_max = float(np.nanmax(raw_depth))
        d_range = d_max - d_min if (d_max - d_min) > 1e-8 else 1.0

        norm_depth = (raw_depth - d_min) / d_range
        norm_depth = np.clip(norm_depth, 0.0, 1.0)

        # Force garbage collection to prevent memory buildup
        gc.collect()
        if torch.cuda.is_available():
            torch.cuda.empty_cache()

        return raw_depth, norm_depth

def compute_spatial_confidence(depth_map: np.ndarray) -> np.ndarray:
    """
    Computes a spatial confidence indicator [0, 1] from depth discontinuities (Sobel edges).
    Areas with high edge gradients have lower confidence; smooth structural facets have high confidence.
    """
    sobelx = cv2.Sobel(depth_map, cv2.CV_64F, 1, 0, ksize=3)
    sobely = cv2.Sobel(depth_map, cv2.CV_64F, 0, 1, ksize=3)
    gradient_mag = np.sqrt(sobelx**2 + sobely**2)
    max_grad = np.max(gradient_mag) if np.max(gradient_mag) > 1e-8 else 1.0
    confidence = 1.0 - np.clip(gradient_mag / max_grad, 0.0, 1.0)
    return confidence.astype(np.float32)
