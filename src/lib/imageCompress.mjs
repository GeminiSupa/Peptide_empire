// Client-side image shrink + compress, used before uploading blog images.
// Keeps images sharp on modern/retina screens (default max width 1400) while
// cutting file size, instead of the old "resize to 500px" rule which looks
// blurry on phones. Runs only in the browser (needs Image/canvas). If anything
// goes wrong it returns the original file untouched, so an upload never breaks
// because compression failed.
export async function compressImage(file, { maxWidth = 1400, maxHeight = 1400, quality = 0.82 } = {}) {
  try {
    if (typeof document === 'undefined' || !file || !file.type?.startsWith('image/')) return file;
    // Leave vector and animated formats alone — canvas would rasterise/flatten them.
    if (/svg|gif/i.test(file.type)) return file;

    const dataUrl = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

    const img = await new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = reject;
      image.src = dataUrl;
    });

    let { width, height } = img;
    const scale = Math.min(1, maxWidth / width, maxHeight / height);
    if (scale >= 1) {
      // Already small enough. Only re-encode big JPEG/PNG files to save bytes.
      if (file.size <= 400 * 1024) return file;
    }
    width = Math.round(width * Math.min(scale, 1));
    height = Math.round(height * Math.min(scale, 1));

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return file;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, 0, 0, width, height);

    const keepPng = /png/i.test(file.type);
    const outType = keepPng ? 'image/png' : 'image/jpeg';
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, outType, quality));
    if (!blob || blob.size >= file.size) return file; // never upload a bigger file

    const base = (file.name || 'image').replace(/\.[^.]+$/, '');
    const ext = keepPng ? 'png' : 'jpg';
    return new File([blob], `${base}.${ext}`, { type: outType, lastModified: Date.now() });
  } catch {
    return file;
  }
}
