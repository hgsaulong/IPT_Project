export const API_BASE_URL = (process.env.REACT_APP_API_URL || 'http://localhost:3001').replace(/\/+$/, '');

export async function apiRequest(path, token, options = {}) {
	const headers = { ...options.headers };
	const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData;
	if (options.body && !isFormData && !headers['Content-Type']) {
		headers['Content-Type'] = 'application/json';
	}
	if (token) headers.Authorization = `Bearer ${token}`;

	const response = await fetch(`${API_BASE_URL}${path}`, { ...options, headers });
	const responseBody = response.status === 204 ? null : await response.json().catch(() => null);
	if (!response.ok) {
		throw new Error(responseBody?.message || `Request failed (${response.status}).`);
	}
	return responseBody;
}

export function productImageUrl(imageUrl) {
	if (!imageUrl) return '/images/product-placeholder.svg';
	if (/^https?:\/\//i.test(imageUrl)) return imageUrl;
	const normalizedPath = imageUrl.trim().replace(/^\/?public\//, '/').replace(/^\/+/, '');
	return `/${encodeURI(normalizedPath)}`;
}

export function handleProductImageError(event) {
	const image = event.currentTarget;
	if (image.dataset.fallbackApplied) return;
	image.dataset.fallbackApplied = 'true';
	image.src = '/images/product-placeholder.svg';
}
