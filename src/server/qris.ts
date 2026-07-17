import QRCode from 'qrcode';

type QrisTag = {
  id: string;
  length: number;
  value: string;
};

function parseTopLevelTags(payloadWithoutCrcValue: string): QrisTag[] {
  const tags: QrisTag[] = [];
  let offset = 0;

  while (offset < payloadWithoutCrcValue.length) {
    const id = payloadWithoutCrcValue.slice(offset, offset + 2);
    const lengthText = payloadWithoutCrcValue.slice(offset + 2, offset + 4);
    if (!/^\d{2}$/.test(id) || !/^\d{2}$/.test(lengthText)) {
      throw new Error('struktur QRIS tidak valid.');
    }

    const length = Number(lengthText);
    const valueStart = offset + 4;
    const valueEnd = valueStart + length;
    if (valueEnd > payloadWithoutCrcValue.length) {
      throw new Error('struktur QRIS tidak valid.');
    }

    tags.push({ id, length, value: payloadWithoutCrcValue.slice(valueStart, valueEnd) });
    offset = valueEnd;
  }

  return tags;
}

export function calculateQrisCrc(input: string): string {
  let crc = 0xffff;
  for (let index = 0; index < input.length; index += 1) {
    crc ^= input.charCodeAt(index) << 8;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc & 0x8000) !== 0 ? (crc << 1) ^ 0x1021 : crc << 1;
      crc &= 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

export function isValidQrisCrc(payload: string): boolean {
  if (!/6304[0-9A-F]{4}$/i.test(payload)) return false;
  return calculateQrisCrc(payload.slice(0, -4)) === payload.slice(-4).toUpperCase();
}

export function validateStaticQrisPayload(input: string): string {
  const payload = input.trim();
  if (!payload.includes('010211')) throw new Error('QRIS harus bertipe statis.');
  if (!payload.includes('5802ID') || !payload.includes('6304')) throw new Error('struktur QRIS tidak valid.');
  if (!isValidQrisCrc(payload)) throw new Error('CRC QRIS tidak valid.');

  const tags = parseTopLevelTags(payload);
  if (tags.filter((tag) => tag.id === '01' && tag.value === '11').length !== 1) {
    throw new Error('QRIS harus bertipe statis.');
  }
  if (tags.some((tag) => tag.id === '54')) {
    throw new Error('struktur QRIS memiliki nominal yang ambigu.');
  }
  if (tags.filter((tag) => tag.id === '58' && tag.value === 'ID').length !== 1) {
    throw new Error('struktur QRIS tidak valid.');
  }

  return payload;
}

export function buildDynamicQrisPayload(staticPayload: string, amount: number): string {
  if (!Number.isSafeInteger(amount) || amount <= 0) {
    throw new Error('nominal QRIS harus berupa bilangan bulat positif.');
  }

  const source = validateStaticQrisPayload(staticPayload);
  const withoutCrc = source.slice(0, -4).replace('010211', '010212');
  const countryMarker = '5802ID';
  const markerIndex = withoutCrc.indexOf(countryMarker);
  if (markerIndex < 0 || withoutCrc.indexOf(countryMarker, markerIndex + 1) >= 0) {
    throw new Error('struktur QRIS tidak valid.');
  }

  const amountText = String(amount);
  const amountTag = `54${amountText.length.toString().padStart(2, '0')}${amountText}`;
  const output = `${withoutCrc.slice(0, markerIndex)}${amountTag}${withoutCrc.slice(markerIndex)}`;
  return `${output}${calculateQrisCrc(output)}`;
}

export async function generateDynamicQris(staticPayload: string, amount: number) {
  const payload = buildDynamicQrisPayload(staticPayload, amount);
  const dataUrl = await QRCode.toDataURL(payload, {
    errorCorrectionLevel: 'M',
    margin: 2,
    width: 320
  });
  return { payload, dataUrl };
}
