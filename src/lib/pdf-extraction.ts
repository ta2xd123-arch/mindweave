import { PDFParse } from 'pdf-parse';
import { sanitizeSourceText, type SourceLocation, withTimeout } from './source-documents';
import { sourceAnalysisConfig } from './source-analysis-config';

export interface ExtractedPdf {
  rawText: string;
  locations: SourceLocation[];
  metadata: { title: string; author: string; publishedAt: string };
  pageCount: number;
}

export function pdfErrorMessage(error: unknown): string {
  const name = error instanceof Error ? error.name : '';
  const message = error instanceof Error ? error.message : '';
  if (name === 'PasswordException' || /password|encrypted/i.test(message)) return '암호화되었거나 비밀번호가 설정된 PDF는 지원하지 않습니다.';
  if (message === 'PDF_PARSE_TIMEOUT') return 'PDF 분석 시간이 제한을 초과했습니다.';
  if (name === 'InvalidPDFException' || name === 'FormatError' || /invalid pdf|format error|xref/i.test(message)) return 'PDF 파일이 손상되었거나 구조가 올바르지 않습니다.';
  return 'PDF 내용을 분석하지 못했습니다.';
}

export async function extractPdfBuffer(bytes: Uint8Array): Promise<ExtractedPdf> {
  const parser = new PDFParse({ data: bytes });
  try {
    return await withTimeout((async () => {
      const info = await parser.getInfo();
      if (info.total > sourceAnalysisConfig.pdfPageLimit) throw new Error(`PDF는 최대 ${sourceAnalysisConfig.pdfPageLimit}페이지까지 처리할 수 있습니다.`);
      const text = await parser.getText();
      const locations: SourceLocation[] = text.pages.map((page) => ({ kind: 'page' as const, start: page.num, end: page.num, text: sanitizeSourceText(page.text) })).filter((page) => page.text);
      if (!locations.length) throw new Error('IMAGE_ONLY_PDF');
      const dates = info.getDateNode();
      return { rawText: locations.map((page) => page.text).join('\n\n'), locations, metadata: { title: String(info.info?.Title || ''), author: String(info.info?.Author || ''), publishedAt: dates.CreationDate?.toISOString().slice(0, 10) || '' }, pageCount: info.total };
    })(), sourceAnalysisConfig.pdfParseTimeoutMs, 'PDF_PARSE_TIMEOUT');
  } catch (error) {
    if (error instanceof Error && error.message === 'IMAGE_ONLY_PDF') throw new Error('이미지로만 구성된 PDF는 텍스트를 추출할 수 없습니다. OCR이 적용된 PDF를 사용해 주세요.');
    if (error instanceof Error && error.message.includes(`최대 ${sourceAnalysisConfig.pdfPageLimit}페이지`)) throw error;
    throw new Error(pdfErrorMessage(error));
  } finally {
    await parser.destroy().catch(() => undefined);
  }
}
