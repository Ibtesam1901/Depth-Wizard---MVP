import os
import json
import numpy as np
import rasterio
from rasterio.transform import from_origin
from PIL import Image

def generate_sample_datasets():
    base_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "datasets")
    
    categories = {
        "urban": {
            "name": "Urban Canyon & Commercial Structures",
            "location": "Bengaluru Central (12.9716° N, 77.5946° E)",
            "description": "Dense urban grid featuring commercial multi-story buildings, flat asphalt, and sharp roof parapets.",
            "relief_range": "15m - 68m",
            "source_sensor": "Cartosat-3 Optical (0.28m PAN / 1.12m MX)",
            "ground_resolution": "0.5m",
            "crs": "EPSG:32643",
            "rmse": 4.12,
            "mae": 2.85,
            "correlation": 0.941
        },
        "sparse": {
            "name": "Semi-Arid Plateau & Flatlands",
            "location": "Deccan Traps (16.8302° N, 75.7100° E)",
            "description": "Open semi-arid terrain with sparse vegetation, gentle planar gradients, and high radiometric uniformity.",
            "relief_range": "580m - 604m",
            "source_sensor": "Resourcesat-2 LISS-4 (5.8m)",
            "ground_resolution": "5.0m",
            "crs": "EPSG:4326",
            "rmse": 1.74,
            "mae": 1.18,
            "correlation": 0.978
        },
        "hilly": {
            "name": "High-Relief Mountain Ridge",
            "location": "Western Ghats Escarpment (14.2150° N, 74.8820° E)",
            "description": "Complex terrain with steep slopes (>35°), deep V-valleys, ridge lines, and varying aspect illumination.",
            "relief_range": "320m - 890m",
            "source_sensor": "Sentinel-2 MultiSpectral (10m)",
            "ground_resolution": "10.0m",
            "crs": "EPSG:32643",
            "rmse": 5.48,
            "mae": 3.92,
            "correlation": 0.923
        },
        "forest": {
            "name": "Dense Deciduous Forest Canopy",
            "location": "Nilgiri Biosphere Reserve (11.5200° N, 76.5400° E)",
            "description": "Continuous closed tree canopy where height estimation evaluates top-of-canopy surface (DSM/CHM).",
            "relief_range": "910m - 985m",
            "source_sensor": "Landsat-9 OLI-2 (15m PAN / 30m MS)",
            "ground_resolution": "15.0m",
            "crs": "EPSG:4326",
            "rmse": 4.89,
            "mae": 3.41,
            "correlation": 0.912
        }
    }

    for cat_key, cat_data in categories.items():
        cat_dir = os.path.join(base_dir, cat_key)
        os.makedirs(cat_dir, exist_ok=True)
        
        # Write metadata.json
        meta_path = os.path.join(cat_dir, "metadata.json")
        with open(meta_path, "w", encoding="utf-8") as f:
            json.dump(cat_data, f, indent=2)

    print("Datasets initialized successfully!")

if __name__ == "__main__":
    generate_sample_datasets()
