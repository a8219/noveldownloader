"""Generate a small launcher icon PNG without external image libraries."""
import struct
import sys
import zlib
from pathlib import Path

SIZE = 192
BG = (103, 80, 164)      # MD3 primary
FG = (255, 255, 255)     # book glyph
ACCENT = (208, 188, 255)


def pixel(x, y):
    # rounded square background
    r = 36
    for cx, cy in ((r, r), (SIZE - r - 1, r), (r, SIZE - r - 1), (SIZE - r - 1, SIZE - r - 1)):
        if (x < r and y < r and (x - cx) ** 2 + (y - cy) ** 2 > r * r) or \
           (x > SIZE - r - 1 and y < r and (x - cx) ** 2 + (y - cy) ** 2 > r * r) or \
           (x < r and y > SIZE - r - 1 and (x - cx) ** 2 + (y - cy) ** 2 > r * r) or \
           (x > SIZE - r - 1 and y > SIZE - r - 1 and (x - cx) ** 2 + (y - cy) ** 2 > r * r):
            return (0, 0, 0, 0)
    # book glyph: two pages with a spine
    left, right = 52, SIZE - 52
    top, bottom = 58, SIZE - 58
    spine = SIZE // 2
    if left <= x <= right and top <= y <= bottom:
        if abs(x - spine) <= 3:
            return ACCENT + (255,)          # spine
        if left + 10 <= x < spine - 4 or spine + 4 < x <= right - 10:
            # page lines
            for k in range(top + 14, bottom - 12, 18):
                if abs(y - k) <= 2:
                    return BG + (255,) if False else (255, 255, 255, 255)
            return FG + (255,)
        if x < left + 10 or x > right - 10:
            return ACCENT + (255,)
    return BG + (255,)


def write_png(path: Path) -> None:
    rows = []
    for y in range(SIZE):
        row = bytearray()
        for x in range(SIZE):
            row += bytes(pixel(x, y))
        rows.append(bytes(row))
    raw = b"".join(b"\x00" + r for r in rows)

    def chunk(tag: bytes, data: bytes) -> bytes:
        return struct.pack(">I", len(data)) + tag + data + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)

    png = b"\x89PNG\r\n\x1a\n"
    png += chunk(b"IHDR", struct.pack(">IIBBBBB", SIZE, SIZE, 8, 6, 0, 0, 0))
    png += chunk(b"IDAT", zlib.compress(raw, 9))
    png += chunk(b"IEND", b"")
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(png)


if __name__ == "__main__":
    write_png(Path(sys.argv[1]))
    print("icon written:", sys.argv[1])
