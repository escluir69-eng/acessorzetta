import { pixDefaults } from './zettaSettings';
export async function makeZettaPixPreview(input: { key: string; name: string; city: string; prefix: string }) {
  const [{ createStaticPix, hasError }, { default: QRCode }] = await Promise.all([import('pix-utils'), import('qrcode')]);
  const merchant = pixDefaults(input.name, input.city);
  if (!merchant.name || !merchant.city) throw new Error('Informe o beneficiário e a cidade.');
  const pix = createStaticPix({ pixKey: input.key.trim(), merchantName: merchant.name, merchantCity: merchant.city, transactionAmount: 50, txid: `${input.prefix.replace(/[^a-zA-Z0-9]/g, '').slice(0,20)}PREV`.slice(0,25) });
  if (hasError(pix)) throw new Error('Confira a chave Pix e os dados do beneficiário.');
  const payload = pix.toBRCode();
  const qr = await QRCode.toDataURL(payload, { width: 220, margin: 2 });
  return { payload, qr };
}
