export const MAX_UPLOAD_SIZE_BYTES = 100 * 1024 * 1024;

const ALLOWED_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/avif'];

export function validateImageFile(file: File) {
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
    return {
      valid: false as const,
      reason: 'Unsupported file type. Please upload a PNG, JPEG, WEBP, or AVIF image.',
    };
  }

  if (file.size > MAX_UPLOAD_SIZE_BYTES) {
    return {
      valid: false as const,
      reason: 'File is too large. Maximum upload size is 100 MB.',
    };
  }

  return {
    valid: true as const,
  };
}
