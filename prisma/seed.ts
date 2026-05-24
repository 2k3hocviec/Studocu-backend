import {
  DocumentStatus,
  DocumentType,
  FileType,
  PrismaClient,
  StorageProvider,
  UserRole,
  UserStatus,
} from "@prisma/client";
import bcrypt from "bcrypt";

const prisma = new PrismaClient();
const demoPassword = "Password@123";

async function seedUsers() {
  const passwordHash = await bcrypt.hash(demoPassword, 10);

  const admin = await prisma.user.upsert({
    where: { email: "admin@hoclieu.local" },
    update: { fullName: "Quan tri HocLieu", passwordHash, status: UserStatus.ACTIVE, role: UserRole.ADMIN },
    create: {
      fullName: "Quan tri HocLieu",
      email: "admin@hoclieu.local",
      passwordHash,
      status: UserStatus.ACTIVE,
      role: UserRole.ADMIN,
      creditBalance: 100,
    },
  });

  const user = await prisma.user.upsert({
    where: { email: "student@hoclieu.local" },
    update: { fullName: "Nguyen Van An", passwordHash, status: UserStatus.ACTIVE, role: UserRole.USER },
    create: {
      fullName: "Nguyen Van An",
      email: "student@hoclieu.local",
      passwordHash,
      status: UserStatus.ACTIVE,
      role: UserRole.USER,
      creditBalance: 20,
    },
  });

  return { admin, user };
}

async function seedCatalog() {
  const bachKhoa = await prisma.school.upsert({
    where: { slug: "dai-hoc-bach-khoa" },
    update: { name: "Dai hoc Bach Khoa" },
    create: { name: "Dai hoc Bach Khoa", slug: "dai-hoc-bach-khoa" },
  });
  const kinhTe = await prisma.school.upsert({
    where: { slug: "dai-hoc-kinh-te" },
    update: { name: "Dai hoc Kinh te" },
    create: { name: "Dai hoc Kinh te", slug: "dai-hoc-kinh-te" },
  });
  const fpt = await prisma.school.upsert({
    where: { slug: "dai-hoc-fpt" },
    update: { name: "Dai hoc FPT" },
    create: { name: "Dai hoc FPT", slug: "dai-hoc-fpt" },
  });
  const ngoaiThuong = await prisma.school.upsert({
    where: { slug: "dai-hoc-ngoai-thuong" },
    update: { name: "Dai hoc Ngoai thuong" },
    create: { name: "Dai hoc Ngoai thuong", slug: "dai-hoc-ngoai-thuong" },
  });

  const subjectEntries = [
    { schoolId: bachKhoa.id, name: "Cau truc du lieu", slug: "cau-truc-du-lieu" },
    { schoolId: bachKhoa.id, name: "Co so du lieu", slug: "co-so-du-lieu" },
    { schoolId: kinhTe.id, name: "Xac suat thong ke", slug: "xac-suat-thong-ke" },
    { schoolId: kinhTe.id, name: "Marketing", slug: "marketing" },
    { schoolId: fpt.id, name: "Lap trinh Web", slug: "lap-trinh-web" },
    { schoolId: ngoaiThuong.id, name: "Tieng Anh", slug: "tieng-anh" },
  ];

  const subjects = await Promise.all(
    subjectEntries.map((subject) =>
      prisma.subject.upsert({
        where: { slug: subject.slug },
        update: { schoolId: subject.schoolId, name: subject.name },
        create: subject,
      }),
    ),
  );

  return {
    schools: { bachKhoa, kinhTe, fpt, ngoaiThuong },
    subjects: Object.fromEntries(subjects.map((subject) => [subject.slug, subject])),
  };
}

async function seedPlans() {
  const plans = [
    { name: "Co ban", price: 49000, durationDays: 30, downloadLimit: 20 },
    { name: "Sinh vien", price: 99000, durationDays: 90, downloadLimit: 100 },
    { name: "Hoc ky", price: 169000, durationDays: 180, downloadLimit: 300 },
  ];

  for (const plan of plans) {
    const existing = await prisma.subscriptionPlan.findFirst({ where: { name: plan.name } });
    if (existing) {
      await prisma.subscriptionPlan.update({ where: { id: existing.id }, data: { ...plan, isActive: true } });
    } else {
      await prisma.subscriptionPlan.create({ data: plan });
    }
  }
}

type DocumentSeed = {
  title: string;
  description: string;
  schoolId: number;
  subjectId: number;
  documentType: DocumentType;
  isPremium: boolean;
  pages: number;
  downloads: number;
};

async function seedDocuments(
  userId: number,
  adminId: number,
  catalogs: Awaited<ReturnType<typeof seedCatalog>>,
) {
  const { bachKhoa, kinhTe, fpt, ngoaiThuong } = catalogs.schools;
  const subjects = catalogs.subjects;
  const documents: DocumentSeed[] = [
    {
      title: "Giai thuat va cau truc du lieu can ban",
      description: "Tong hop cay, do thi va cac thuat toan sap xep.",
      schoolId: bachKhoa.id,
      subjectId: subjects["cau-truc-du-lieu"].id,
      documentType: DocumentType.LECTURE,
      isPremium: false,
      pages: 84,
      downloads: 1250,
    },
    {
      title: "De thi cuoi ky Xac suat thong ke 2025",
      description: "Bo de on tap kem dap an tham khao.",
      schoolId: kinhTe.id,
      subjectId: subjects["xac-suat-thong-ke"].id,
      documentType: DocumentType.EXAM,
      isPremium: false,
      pages: 18,
      downloads: 930,
    },
    {
      title: "Tom tat Lap trinh Web voi React",
      description: "Ghi chu component, hooks va quan ly trang thai.",
      schoolId: fpt.id,
      subjectId: subjects["lap-trinh-web"].id,
      documentType: DocumentType.NOTE,
      isPremium: true,
      pages: 42,
      downloads: 720,
    },
    {
      title: "Bai tap thuc hanh Co so du lieu",
      description: "Mo hinh quan he, SQL truy van va chuan hoa du lieu.",
      schoolId: bachKhoa.id,
      subjectId: subjects["co-so-du-lieu"].id,
      documentType: DocumentType.ASSIGNMENT,
      isPremium: false,
      pages: 35,
      downloads: 488,
    },
    {
      title: "De cuong Marketing can ban",
      description: "Kien thuc trong tam va cau hoi on thi.",
      schoolId: kinhTe.id,
      subjectId: subjects.marketing.id,
      documentType: DocumentType.LECTURE,
      isPremium: true,
      pages: 56,
      downloads: 614,
    },
    {
      title: "Tai lieu tham khao Tieng Anh hoc thuat",
      description: "Mau viet luan va tu vung theo chu de.",
      schoolId: ngoaiThuong.id,
      subjectId: subjects["tieng-anh"].id,
      documentType: DocumentType.OTHER,
      isPremium: false,
      pages: 67,
      downloads: 301,
    },
  ];

  for (const document of documents) {
    const existing = await prisma.document.findFirst({
      where: { title: document.title, uploaderId: userId },
    });
    const data = {
      schoolId: document.schoolId,
      subjectId: document.subjectId,
      title: document.title,
      description: document.description,
      documentType: document.documentType,
      status: DocumentStatus.APPROVED,
      isPremium: document.isPremium,
      downloadCount: document.downloads,
      viewCount: document.downloads * 3,
      approvedBy: adminId,
      approvedAt: new Date(),
    };
    const file = {
      fileUrl: `https://example.com/documents/${encodeURIComponent(document.title)}.pdf`,
      originalFilename: `${document.title}.pdf`,
      fileType: FileType.PDF,
      fileSize: document.pages * 12000,
      totalPages: document.pages,
      storageProvider: StorageProvider.CLOUDINARY,
    };

    if (existing) {
      await prisma.document.update({
        where: { id: existing.id },
        data: {
          ...data,
          documentFile: {
            upsert: {
              update: file,
              create: file,
            },
          },
        },
      });
    } else {
      await prisma.document.create({
        data: {
          uploaderId: userId,
          ...data,
          documentFile: { create: file },
        },
      });
    }
  }
}

async function main() {
  const { admin, user } = await seedUsers();
  const catalogs = await seedCatalog();
  await seedPlans();
  await seedDocuments(user.id, admin.id, catalogs);

  console.log("Seed completed.");
  console.log(`Admin: admin@hoclieu.local / ${demoPassword}`);
  console.log(`User: student@hoclieu.local / ${demoPassword}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
