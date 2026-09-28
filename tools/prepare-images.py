from pathlib import Path
from PIL import Image

DEST = Path(__file__).resolve().parents[1] / 'assets' / 'images'
SOURCE = Path(__file__).resolve().parents[1] / 'source-images'

IMAGES = {
    SOURCE / 'homepage-pozo-artesiano-original.png': ('pozo-artesiano-perforacion.webp', 2000, 82),
    SOURCE / 'servicio-pozo-artesiano-original.png': ('pozo-artesiano-servicio.webp', 1400, 80),
    SOURCE / 'bomba-tablero-original.png': ('bomba-pozo-artesiano.webp', 1400, 80),
    SOURCE / 'desague-camion-original.png': ('desague-pozo-ciego-camion.webp', 1400, 80),
    SOURCE / 'pozo-lleno-inspeccion-original.png': ('pozo-ciego-lleno-inspeccion.webp', 1400, 80),
    SOURCE / 'sistema-septico-original.png': ('pozo-septico-instalacion.webp', 1400, 80),
    SOURCE / 'tratamiento-agua-original.png': ('tratamiento-agua-filtros.webp', 1400, 80),
    SOURCE / 'analisis-agua-original.png': ('analisis-calidad-agua.webp', 1200, 80),
}

DEST.mkdir(parents=True, exist_ok=True)

for source_path, (dest_name, max_width, quality) in IMAGES.items():
    with Image.open(source_path) as image:
        image = image.convert('RGB')
        if image.width > max_width:
            height = round(image.height * max_width / image.width)
            image = image.resize((max_width, height), Image.Resampling.LANCZOS)
        image.save(DEST / dest_name, 'WEBP', quality=quality, method=6)
        print(f'{dest_name}: {image.width}x{image.height}')
