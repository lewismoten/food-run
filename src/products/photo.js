"use strict";
function showProductPhoto() {
  const box = $("#quickPhotoPreview");
  box.hidden = !quickPhotoData;
  box.innerHTML = quickPhotoData
    ? `<img src="${quickPhotoData}" alt="Product package photo"><button type="button" class="secondary" id="removeQuickPhoto">Remove photo</button>`
    : "";
}

async function imageFromFile(file) {
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    await new Promise((resolve, reject) => {
      image.onload = resolve;
      image.onerror = reject;
    });
    return image;
  } finally {
    // The image has finished loading before the object URL is released.
    URL.revokeObjectURL(url);
  }
}

async function handleProductPhoto(file) {
  if (!file) return;
  if (!file.type.startsWith("image/")) return toast("Choose an image file.");
  try {
    const image = await imageFromFile(file);
    const canvas = document.createElement("canvas");
    const scale = Math.min(
      1,
      720 / Math.max(image.naturalWidth, image.naturalHeight),
    );
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    canvas.getContext("2d").drawImage(image, 0, 0, canvas.width, canvas.height);
    quickPhotoData = canvas.toDataURL("image/jpeg", 0.72);
    showProductPhoto();
    productPreview();
  } catch {
    toast("Could not read that photo. Try another image.");
  }
}
