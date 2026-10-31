# Produced hero.jpg and cover.jpg, original abstract images (OrganizeOS's own work); run `python3 generate.py` with Pillow to rebuild them beside this file.
import random
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw, ImageFilter


def paint(width, height, background_from, background_to, shapes, seed):
    # A diagonal wash from light to deep: a vertical and a horizontal ramp
    # averaged.
    vertical = Image.linear_gradient("L").resize((width, height))
    horizontal = vertical.rotate(90, expand=True).resize((width, height))
    ramp = ImageChops.add(vertical, horizontal, scale=2)
    canvas = Image.composite(
        Image.new("RGB", (width, height), background_to),
        Image.new("RGB", (width, height), background_from),
        ramp,
    )

    # Soft overlapping shapes, each blurred on a layer of its own.
    for cx, cy, rx, ry, colour, opacity, blur in shapes:
        mask = Image.new("L", (width, height), 0)
        ImageDraw.Draw(mask).ellipse(
            (cx - rx, cy - ry, cx + rx, cy + ry), fill=int(255 * opacity)
        )
        mask = mask.filter(ImageFilter.GaussianBlur(blur))
        canvas = Image.composite(
            Image.new("RGB", (width, height), colour), canvas, mask
        )

    # A little seeded grain (plus or minus 4 levels), so the gradients do not
    # band and the image is the same on every run.
    grain = (
        Image.frombytes(
            "L", (width, height), random.Random(seed).randbytes(width * height)
        )
        .point(lambda value: 124 + value // 32)
        .convert("RGB")
    )
    return ImageChops.add(canvas, grain, scale=1.0, offset=-128)


def save(image, name):
    image.save(
        Path(__file__).with_name(name),
        "JPEG",
        quality=84,
        optimize=True,
        progressive=True,
    )


# hero.jpg, the page's background: muted blues, with a few warm accents.
save(
    paint(
        1600,
        900,
        (226, 234, 244),
        (92, 124, 170),
        [
            # (centre x, centre y, radius x, radius y, colour, opacity, blur)
            (300, 260, 470, 380, (84, 128, 180), 0.78, 38),
            (1230, 210, 520, 330, (160, 190, 220), 0.80, 44),
            (860, 600, 640, 300, (50, 84, 138), 0.62, 52),
            (1300, 690, 380, 270, (236, 170, 126), 0.74, 40),
            (330, 740, 330, 220, (242, 208, 156), 0.70, 36),
            (900, 300, 250, 190, (216, 124, 100), 0.46, 34),
            (1530, 430, 200, 440, (122, 160, 204), 0.55, 40),
        ],
        7,
    ),
    "hero.jpg",
)

# cover.jpg, the preview's sample event cover (previewEventCover), which no
# page shows: warm sands and terracotta, with a little blue, at 3:2.
save(
    paint(
        1200,
        800,
        (246, 230, 206),
        (176, 104, 72),
        [
            (260, 220, 360, 280, (232, 176, 120), 0.76, 34),
            (900, 180, 400, 250, (250, 214, 168), 0.80, 40),
            (640, 520, 480, 230, (156, 82, 60), 0.60, 46),
            (980, 600, 290, 200, (120, 150, 190), 0.58, 36),
            (240, 640, 250, 170, (210, 120, 86), 0.66, 32),
        ],
        11,
    ),
    "cover.jpg",
)
