# Produced hero.jpg, an original abstract image (OrganizeOS's own work); run `python3 generate.py` with Pillow to rebuild it beside this file.
import random
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw, ImageFilter

WIDTH, HEIGHT = 1600, 900

# Muted blues, with a few warm accents.
BACKGROUND_FROM = (226, 234, 244)
BACKGROUND_TO = (92, 124, 170)
SHAPES = [
    # (centre x, centre y, radius x, radius y, colour, opacity, blur)
    (300, 260, 470, 380, (84, 128, 180), 0.78, 38),
    (1230, 210, 520, 330, (160, 190, 220), 0.80, 44),
    (860, 600, 640, 300, (50, 84, 138), 0.62, 52),
    (1300, 690, 380, 270, (236, 170, 126), 0.74, 40),
    (330, 740, 330, 220, (242, 208, 156), 0.70, 36),
    (900, 300, 250, 190, (216, 124, 100), 0.46, 34),
    (1530, 430, 200, 440, (122, 160, 204), 0.55, 40),
]

# A diagonal wash from light to deep blue: a vertical and a horizontal ramp
# averaged.
vertical = Image.linear_gradient("L").resize((WIDTH, HEIGHT))
horizontal = vertical.rotate(90, expand=True).resize((WIDTH, HEIGHT))
ramp = ImageChops.add(vertical, horizontal, scale=2)
canvas = Image.composite(
    Image.new("RGB", (WIDTH, HEIGHT), BACKGROUND_TO),
    Image.new("RGB", (WIDTH, HEIGHT), BACKGROUND_FROM),
    ramp,
)

# Soft overlapping shapes, each blurred on a layer of its own.
for cx, cy, rx, ry, colour, opacity, blur in SHAPES:
    mask = Image.new("L", (WIDTH, HEIGHT), 0)
    ImageDraw.Draw(mask).ellipse(
        (cx - rx, cy - ry, cx + rx, cy + ry), fill=int(255 * opacity)
    )
    mask = mask.filter(ImageFilter.GaussianBlur(blur))
    canvas = Image.composite(Image.new("RGB", (WIDTH, HEIGHT), colour), canvas, mask)

# A little seeded grain (plus or minus 4 levels), so the gradients do not band
# and the image is the same on every run.
grain = (
    Image.frombytes("L", (WIDTH, HEIGHT), random.Random(7).randbytes(WIDTH * HEIGHT))
    .point(lambda value: 124 + value // 32)
    .convert("RGB")
)
canvas = ImageChops.add(canvas, grain, scale=1.0, offset=-128)

canvas.save(
    Path(__file__).with_name("hero.jpg"),
    "JPEG",
    quality=84,
    optimize=True,
    progressive=True,
)
