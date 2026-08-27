from PIL import Image
import os

img = Image.open("icon.png")
img.save("icon.ico", format="ICO", sizes=[(256, 256), (128, 128), (64, 64), (32, 32)])
print("ico saved")
