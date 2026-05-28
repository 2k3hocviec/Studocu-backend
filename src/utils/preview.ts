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

async function convertOfficeToPdf(buffer: Buffer, fileType: Exclude<PreviewFileType, "PDF">) {
  const soffice = env.SOFFICE_PATH || "soffice";
  const workDir = await mkdtemp(path.join(tmpdir(), "studocu-preview-"));
  const inputPath = path.join(workDir, `input-${randomUUID()}${extensionByType[fileType]}`);

  try {
    await writeFile(inputPath, buffer);
    await execFileAsync(
      soffice,
      ["--headless", "--convert-to", "pdf", "--outdir", workDir, inputPath],
      { timeout: 60_000, windowsHide: true },
    );

    const pdfPath = path.join(workDir, `${path.basename(inputPath, extensionByType[fileType])}.pdf`);
    return await readFile(pdfPath);
  } catch (error) {
    throw dependencyError(error, "LibreOffice");
  } finally {
    await rm(workDir, { recursive: true, force: true });
  }
}

async function renderPdfPreview(pdfBuffer: Buffer): Promise<GeneratedPreview> {
  const workDir = await mkdtemp(path.join(tmpdir(), "studocu-pdf-pages-"));
  const pdfPath = path.join(workDir, `input-${randomUUID()}.pdf`);
  const outputPrefix = path.join(workDir, "page");

  try {
    await writeFile(pdfPath, pdfBuffer);
    await execFileAsync(
      popplerCommand(),
      ["-png", "-r", "144", pdfPath, outputPrefix],
      { timeout: 120_000, windowsHide: true },
    );

    const files = (await readdir(workDir))
      .map((file) => {
        const match = /^page-(\d+)\.png$/i.exec(file);
        return match ? { file, pageNumber: Number(match[1]) } : null;
      })
      .filter((file): file is { file: string; pageNumber: number } => Boolean(file))
      .sort((a, b) => a.pageNumber - b.pageNumber);

    if (!files.length) {
      throw new AppError("Preview generation failed: Poppler did not generate any page images", 500);
    }

    return {
      totalPages: files.length,
      pages: await Promise.all(files.map(async (file, index) => ({
        pageNumber: index + 1,
        image: await readFile(path.join(workDir, file.file)),
      }))),
    };
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw dependencyError(error, "Poppler");
  } finally {
    await rm(workDir, { recursive: true, force: true });
  }
}

export async function generateDocumentPreview(file: PreviewInputFile, fileType: PreviewFileType) {
  const pdfBuffer = fileType === "PDF"
    ? file.buffer
    : await convertOfficeToPdf(file.buffer, fileType);

  return renderPdfPreview(pdfBuffer);
}
