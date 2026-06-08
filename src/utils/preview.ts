import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { env } from "../config/env";
import { AppError } from "../middlewares/errorHandler";

const execFileAsync = promisify(execFile);
type PreviewFileType = "PDF" | "DOCX" | "PPTX";
type PreviewInputFile = { buffer: Buffer };

export type GeneratedPreview = {
  totalPages: number;
  pages: Array<{ pageNumber: number; image: Buffer }>;
};

const extensionByType: Record<PreviewFileType, string> = {
  PDF: ".pdf",
  DOCX: ".docx",
  PPTX: ".pptx",
};

export const MAX_PREVIEW_PAGES = 5;
const PDF_RENDER_TIMEOUT_MS = 300_000;
const OFFICE_CONVERT_TIMEOUT_MS = 180_000;
const INVALID_DOCUMENT_MESSAGE = "File bị lỗi nên không upload lên được. Vui lòng kiểm tra lại file và thử file khác.";
const OVERSIZED_DOCUMENT_MESSAGE = "File quá lớn hoặc quá phức tạp nên hệ thống không xử lý được. Vui lòng thử file khác hoặc giảm dung lượng file.";

export function previewPageCount(totalPages: number) {
  return Math.min(MAX_PREVIEW_PAGES, Math.max(1, Math.ceil(totalPages * 0.3)));
}

function popplerCommand() {
  const configured = env.PDFTOPPM_PATH || env.POPPLER_PATH;
  if (!configured) return "pdftoppm";
  const normalized = configured.replace(/\\/g, "/").toLowerCase();
  if (normalized.endsWith("pdftoppm") || normalized.endsWith("pdftoppm.exe")) return configured;
  return path.join(configured, process.platform === "win32" ? "pdftoppm.exe" : "pdftoppm");
}

function dependencyError(error: unknown, dependency: "LibreOffice" | "Poppler") {
  const message = error instanceof Error ? error.message : "Unknown error";
  const command = dependency === "LibreOffice" ? "soffice" : "pdftoppm/poppler-utils";
  if ((error as NodeJS.ErrnoException | undefined)?.code === "ENOENT") {
    return new AppError(`Preview generation failed: ${dependency} is required. Please install ${command} or configure the executable path. ${message}`, 500);
  }
  return new AppError(`Preview generation failed: ${dependency} could not process the document. ${message}`, 500);
}

function invalidDocumentError() {
  return new AppError(INVALID_DOCUMENT_MESSAGE, 400);
}

function oversizedDocumentError() {
  return new AppError(OVERSIZED_DOCUMENT_MESSAGE, 400);
}

function isTimeoutError(error: unknown) {
  const maybeError = error as NodeJS.ErrnoException & { killed?: boolean; signal?: string };
  const message = error instanceof Error ? error.message.toLowerCase() : "";
  return maybeError.code === "ETIMEDOUT" || maybeError.killed || maybeError.signal === "SIGTERM" || message.includes("timed out");
}

function isZipOfficeFile(buffer: Buffer) {
  return buffer.length >= 4
    && buffer[0] === 0x50
    && buffer[1] === 0x4b
    && (
      (buffer[2] === 0x03 && buffer[3] === 0x04)
      || (buffer[2] === 0x05 && buffer[3] === 0x06)
      || (buffer[2] === 0x07 && buffer[3] === 0x08)
    );
}

function validateUploadBuffer(buffer: Buffer, fileType: PreviewFileType) {
  if (!buffer.length) {
    throw invalidDocumentError();
  }
  if (fileType === "PDF" && !buffer.subarray(0, 1024).includes(Buffer.from("%PDF-"))) {
    throw invalidDocumentError();
  }
  if ((fileType === "DOCX" || fileType === "PPTX") && !isZipOfficeFile(buffer)) {
    throw invalidDocumentError();
  }
}

async function pdfPageCount(pdfBuffer: Buffer) {
  try {
    const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
    const loadingTask = pdfjs.getDocument({ data: new Uint8Array(pdfBuffer) });
    const document = await loadingTask.promise;
    try {
      return document.numPages;
    } finally {
      await document.destroy();
    }
  } catch {
    throw invalidDocumentError();
  }
}

async function convertOfficeToPdf(buffer: Buffer, fileType: Exclude<PreviewFileType, "PDF">) {
  const soffice = env.SOFFICE_PATH || "soffice";
  const workDir = await mkdtemp(path.join(tmpdir(), "studocu-preview-"));
  const inputPath = path.join(workDir, `input-${randomUUID()}${extensionByType[fileType]}`);

  try {
    await writeFile(inputPath, buffer);
    await execFileAsync(
      soffice,
      ["--headless", "--convert-to", "pdf", "--outdir", workDir, inputPath],
      { timeout: OFFICE_CONVERT_TIMEOUT_MS, windowsHide: true },
    );

    const pdfPath = path.join(workDir, `${path.basename(inputPath, extensionByType[fileType])}.pdf`);
    return await readFile(pdfPath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException | undefined)?.code === "ENOENT") {
      throw dependencyError(error, "LibreOffice");
    }
    if (isTimeoutError(error)) {
      throw oversizedDocumentError();
    }
    throw invalidDocumentError();
  } finally {
    await rm(workDir, { recursive: true, force: true });
  }
}

async function renderPdfPreview(pdfBuffer: Buffer): Promise<GeneratedPreview> {
  const workDir = await mkdtemp(path.join(tmpdir(), "studocu-pdf-pages-"));
  const pdfPath = path.join(workDir, `input-${randomUUID()}.pdf`);
  const outputPrefix = path.join(workDir, "page");

  try {
    const totalPages = await pdfPageCount(pdfBuffer);
    const previewPages = previewPageCount(totalPages);
    await writeFile(pdfPath, pdfBuffer);
    await execFileAsync(
      popplerCommand(),
      ["-png", "-r", "144", "-f", "1", "-l", String(previewPages), pdfPath, outputPrefix],
      { timeout: PDF_RENDER_TIMEOUT_MS, windowsHide: true },
    );

    const files = (await readdir(workDir))
      .map((file) => {
        const match = /^page-(\d+)\.png$/i.exec(file);
        return match ? { file, pageNumber: Number(match[1]) } : null;
      })
      .filter((file): file is { file: string; pageNumber: number } => Boolean(file))
      .sort((a, b) => a.pageNumber - b.pageNumber);

    if (!files.length) {
      throw invalidDocumentError();
    }

    return {
      totalPages,
      pages: await Promise.all(files.map(async (file, index) => ({
        pageNumber: index + 1,
        image: await readFile(path.join(workDir, file.file)),
      }))),
    };
  } catch (error) {
    if (error instanceof AppError) throw error;
    if ((error as NodeJS.ErrnoException | undefined)?.code === "ENOENT") {
      throw dependencyError(error, "Poppler");
    }
    if (isTimeoutError(error)) {
      throw oversizedDocumentError();
    }
    throw invalidDocumentError();
  } finally {
    await rm(workDir, { recursive: true, force: true });
  }
}

export async function generateDocumentPreview(file: PreviewInputFile, fileType: PreviewFileType) {
  validateUploadBuffer(file.buffer, fileType);
  const pdfBuffer = fileType === "PDF"
    ? file.buffer
    : await convertOfficeToPdf(file.buffer, fileType);

  return renderPdfPreview(pdfBuffer);
}
