from PIL import Image
import glob
import os

for img_path in glob.glob("*.png"):
    print(f"Processing {img_path}")
    img = Image.open(img_path).convert("RGBA")
    data = img.getdata()
    
    new_data = []
    for item in data:
        # Check if the pixel is black or very close to black
        # item is (R, G, B, A)
        r, g, b, a = item
        if r < 15 and g < 15 and b < 15:
            # Make it transparent
            new_data.append((255, 255, 255, 0))
        else:
            new_data.append(item)
            
    img.putdata(new_data)
    img.save(img_path)
print("Done")
