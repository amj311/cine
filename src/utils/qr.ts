export function getQrUrl(data: string) {
	return "https://api.qrserver.com/v1/create-qr-code/?data=" + encodeURIComponent(data);
}