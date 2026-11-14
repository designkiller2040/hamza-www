# Makes smaller copies of every painting in images/artworks/ so the Works page
# loads fast: images/artworks/900/<name>.jpg and images/artworks/1400/<name>.jpg.
# The build (build.mjs) offers them to the browser through srcset, which then
# downloads only the size it needs. Originals stay as the largest size.
# Run after adding a new painting:  python3 tools/resize-artworks.py
import os
from PIL import Image

SRC = os.path.join(os.path.dirname(__file__), '..', 'images', 'artworks')
for width in (900, 1400):
    out = os.path.join(SRC, str(width))
    os.makedirs(out, exist_ok=True)
    for name in sorted(os.listdir(SRC)):
        if not name.lower().endswith(('.jpg', '.jpeg')):
            continue
        im = Image.open(os.path.join(SRC, name))
        if im.width <= width:
            continue
        h = round(im.height * width / im.width)
        small = im.convert('RGB').resize((width, h), Image.LANCZOS)
        small.save(os.path.join(out, name), 'JPEG', quality=88, progressive=True,
                   optimize=True, icc_profile=im.info.get('icc_profile'))

# Tiny blurred previews (about 1 KB each), shown instantly while the sharp image
# loads. Saved as images/artworks/blur.json, read by build.mjs.
import base64, io, json
blur = {}
for name in sorted(os.listdir(SRC)):
    if not name.lower().endswith(('.jpg', '.jpeg')):
        continue
    im = Image.open(os.path.join(SRC, name)).convert('RGB')
    w = 24
    h = max(1, round(im.height * w / im.width))
    buf = io.BytesIO()
    im.resize((w, h), Image.LANCZOS).save(buf, 'JPEG', quality=70)
    blur[name] = {'w': w, 'h': h, 'jpg': base64.b64encode(buf.getvalue()).decode()}
with open(os.path.join(SRC, 'blur.json'), 'w') as f:
    json.dump(blur, f, indent=0)
