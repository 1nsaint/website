#!/usr/bin/env python3
"""
Simple script to resize platform logos to 64x64px with transparent backgrounds
Just drop your logo images in this directory and run this script
"""
from PIL import Image
from pathlib import Path
import os

TARGET_SIZE = 64
BRAND_LOGO_SIZE = 80  # Bigger for main brand logos
TARGET_DIR = Path(__file__).parent

# Brand logos that should keep their backgrounds
BRAND_LOGOS = {'nintendo.png', 'playstation.png', 'xbox.png', 'pc.png', 'steam.png'}

print("🎮 Resizing platform logos...")
print(f"📁 Directory: {TARGET_DIR}")
print("")

# Find all image files (excluding this script and already processed files)
image_extensions = {'.png', '.jpg', '.jpeg', '.svg', '.webp'}
processed = 0
skipped = 0

for file_path in TARGET_DIR.iterdir():
    if file_path.suffix.lower() in image_extensions and file_path.name != 'resize_logos.py':
        try:
            # Open image
            img = Image.open(file_path)
            
            # Check if this is a brand logo (should keep background)
            is_brand_logo = file_path.name.lower() in BRAND_LOGOS
            target_size = BRAND_LOGO_SIZE if is_brand_logo else TARGET_SIZE
            
            # Convert to RGBA if not already
            if img.mode != 'RGBA':
                img = img.convert('RGBA')
            
            # Only remove white backgrounds for non-brand logos
            if not is_brand_logo:
                data = img.getdata()
                new_data = []
                for item in data:
                    r, g, b, a = item
                    # Remove white/very light pixels
                    if a > 0 and r > 250 and g > 250 and b > 250:
                        new_data.append((r, g, b, 0))  # Make transparent
                    else:
                        new_data.append(item)
                img.putdata(new_data)
            # Brand logos keep their backgrounds (white elements, etc.)
            
            # Resize preserving aspect ratio
            img.thumbnail((target_size, target_size), Image.Resampling.LANCZOS)
            
            # Create square canvas
            if is_brand_logo:
                # Brand logos: white background
                square_img = Image.new('RGBA', (target_size, target_size), (255, 255, 255, 255))
            else:
                # Regular logos: transparent background
                square_img = Image.new('RGBA', (target_size, target_size), (0, 0, 0, 0))
            
            x_offset = (target_size - img.size[0]) // 2
            y_offset = (target_size - img.size[1]) // 2
            
            # Paste with alpha channel
            square_img.paste(img, (x_offset, y_offset), img.split()[3])
            
            # Save as PNG (overwrite original if it's not PNG, or save as .png)
            output_path = file_path.with_suffix('.png')
            square_img.save(output_path, 'PNG')
            
            file_size = output_path.stat().st_size
            logo_type = "BRAND (with background)" if is_brand_logo else "platform"
            print(f"✅ {file_path.name} → {output_path.name} ({target_size}x{target_size}, {file_size} bytes, {logo_type})")
            processed += 1
            
            # Remove original if it wasn't PNG
            if file_path.suffix.lower() != '.png':
                file_path.unlink()
                
        except Exception as e:
            print(f"❌ {file_path.name}: {str(e)[:50]}")
            skipped += 1

print("")
print(f"✅ Processed: {processed}")
if skipped > 0:
    print(f"⚠️  Skipped: {skipped}")

