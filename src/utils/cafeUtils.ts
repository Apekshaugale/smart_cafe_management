/**
 * Cafe utility functions for formatting, calculations, and SVG QR generation
 */

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount);
}

export function calculateCartTotals(items: Array<{ price: number; quantity: number }>) {
  const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const gstRate = 0.05; // 5% GST for restaurants
  const gstAmount = Math.round((subtotal * gstRate + Number.EPSILON) * 100) / 100;
  const grandTotal = Math.round((subtotal + gstAmount + Number.EPSILON) * 100) / 100;

  return {
    subtotal,
    gstAmount,
    grandTotal,
  };
}

export function generateQrSvgUrl(tableNumber: number, appBaseUrl?: string): string {
  const url = `${appBaseUrl || window.location.origin}?table=${tableNumber}`;
  // We can construct a QR code representation or return an SVG data url
  return url;
}
