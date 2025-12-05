#!/usr/bin/env python3
"""
Restore main brand logos (Nintendo, PlayStation, Xbox, PC) with their backgrounds
These are the big logos at the top of platform cards - they should have backgrounds
"""
from PIL import Image
from pathlib import Path
import requests
import base64
import io

TARGET_DIR = Path(__file__).parent
TARGET_SIZE = 80  # Bigger for the top of cards

# These are the main brand logos that should have backgrounds
BRAND_LOGOS = {
    'nintendo.png': 'https://upload.wikimedia.org/wikipedia/commons/7/7d/Nintendo_Switch_logo.svg',
    'playstation.png': 'https://upload.wikimedia.org/wikipedia/commons/0/00/PlayStation_logo.svg',
    'xbox.png': 'https://upload.wikimedia.org/wikipedia/commons/8/8d/Xbox_logo.svg',
    'pc.png': 'https://upload.wikimedia.org/wikipedia/commons/8/87/Windows_logo_-_2021.svg',
}

print("🎮 Restoring main brand logos with backgrounds...")
print("")

for filename, svg_url in BRAND_LOGOS.items():
    try:
        print(f"  Downloading {filename}...")
        
        # Download SVG
        response = requests.get(svg_url, timeout=30, headers={
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        })
        response.raise_for_status()
        
        # For now, we'll need to use a different approach
        # Since we don't have browser automation here, let's create a note
        print(f"  ⚠️  {filename}: Need to download manually or use browser")
        print(f"     URL: {svg_url}")
        print(f"     Save as: {TARGET_DIR / filename}")
        print("")
        
    except Exception as e:
        print(f"  ❌ {filename}: {str(e)[:50]}")
        print("")

print("")
print("💡 Since browser automation was removed, you can:")
print("   1. Download the SVGs from the URLs above")
print("   2. Convert them to PNG (keep backgrounds)")
print("   3. Resize to 80x80px")
print("   4. Save in this directory")
print("")
print("Or I can create a simpler version that keeps backgrounds...")




