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
const demoPassword = "12345678";

async function seedUsers() {
  const passwordHash = await bcrypt.hash(demoPassword, 10);

  await prisma.user.updateMany({
    where: {
      role: UserRole.ADMIN,
      email: { not: "admin@hoclieu.local" },
      deletedAt: null,
    },
    data: { role: UserRole.USER },
  });

  const admin = await prisma.user.upsert({
    where: { email: "admin@hoclieu.local" },
    update: {
      fullName: "Quản trị Học Liệu",
      passwordHash,
      status: UserStatus.ACTIVE,
      role: UserRole.ADMIN,
      creditBalance: 100,
    },
    create: {
      fullName: "Quản trị Học Liệu",
      email: "admin@hoclieu.local",
      passwordHash,
      status: UserStatus.ACTIVE,
      role: UserRole.ADMIN,
      creditBalance: 100,
    },
  });

  const demoUsers = [
    { fullName: "Nguyễn Văn An", email: "student@hoclieu.local", creditBalance: 20 },
    { fullName: "Trần Thị Bình", email: "binh.tran@hoclieu.local", creditBalance: 15 },
    { fullName: "Lê Minh Châu", email: "chau.le@hoclieu.local", creditBalance: 25 },
    { fullName: "Phạm Quốc Dũng", email: "dung.pham@hoclieu.local", creditBalance: 10 },
    { fullName: "Hoàng Gia Hân", email: "han.hoang@hoclieu.local", creditBalance: 30 },
  ];

  const users = await Promise.all(
    demoUsers.map((demoUser) =>
      prisma.user.upsert({
        where: { email: demoUser.email },
        update: {
          fullName: demoUser.fullName,
          passwordHash,
          status: UserStatus.ACTIVE,
          role: UserRole.USER,
        },
        create: {
          ...demoUser,
          passwordHash,
          status: UserStatus.ACTIVE,
          role: UserRole.USER,
        },
      }),
    ),
  );

  await prisma.user.deleteMany({
    where: { email: { in: ["khoa.do@hoclieu.local"] } },
  });

  return { admin, users };
}

async function seedCatalog() {
  const bachKhoa = await prisma.school.upsert({
    where: { slug: "dai-hoc-bach-khoa" },
    update: { name: "Đại học Bách Khoa" },
    create: { name: "Đại học Bách Khoa", slug: "dai-hoc-bach-khoa" },
  });
  const kinhTe = await prisma.school.upsert({
    where: { slug: "dai-hoc-kinh-te" },
    update: { name: "Đại học Kinh tế" },
    create: { name: "Đại học Kinh tế", slug: "dai-hoc-kinh-te" },
  });
  const fpt = await prisma.school.upsert({
    where: { slug: "dai-hoc-fpt" },
    update: { name: "Đại học FPT" },
    create: { name: "Đại học FPT", slug: "dai-hoc-fpt" },
  });
  const ngoaiThuong = await prisma.school.upsert({
    where: { slug: "dai-hoc-ngoai-thuong" },
    update: { name: "Đại học Ngoại thương" },
    create: { name: "Đại học Ngoại thương", slug: "dai-hoc-ngoai-thuong" },
  });

  const subjectEntries = [
    { schoolId: bachKhoa.id, name: "Cấu trúc dữ liệu", slug: "cau-truc-du-lieu" },
    { schoolId: bachKhoa.id, name: "Cơ sở dữ liệu", slug: "co-so-du-lieu" },
    { schoolId: kinhTe.id, name: "Xác suất thống kê", slug: "xac-suat-thong-ke" },
    { schoolId: kinhTe.id, name: "Marketing", slug: "marketing" },
    { schoolId: fpt.id, name: "Lập trình Web", slug: "lap-trinh-web" },
    { schoolId: ngoaiThuong.id, name: "Tiếng Anh", slug: "tieng-anh" },
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
    { name: "Cơ bản", oldName: "Co ban", price: 49000, durationDays: 30, downloadLimit: 20 },
    { name: "Sinh viên", oldName: "Sinh vien", price: 99000, durationDays: 90, downloadLimit: 100 },
    { name: "Học kỳ", oldName: "Hoc ky", price: 169000, durationDays: 180, downloadLimit: 300 },
  ];

  for (const plan of plans) {
    const { oldName, ...data } = plan;
    const existing = await prisma.subscriptionPlan.findFirst({ where: { name: { in: [plan.name, oldName] } } });
    if (existing) {
      await prisma.subscriptionPlan.update({ where: { id: existing.id }, data: { ...data, isActive: true } });
    } else {
      await prisma.subscriptionPlan.create({ data });
    }
  }
}

type DocumentSeed = {
  title: string;
  oldTitle: string;
  description: string;
  schoolId: number;
  subjectId: number;
  documentType: DocumentType;
  pages: number;
  downloads: number;
  fileUrl?: string; // Optional custom file URL
};

async function seedDocuments(
  userId: number,
  approverId: number,
  catalogs: Awaited<ReturnType<typeof seedCatalog>>,
) {
  const { bachKhoa, kinhTe, fpt, ngoaiThuong } = catalogs.schools;
  const subjects = catalogs.subjects;
  const documents: DocumentSeed[] = [
    {
      title: "Giải thuật và cấu trúc dữ liệu căn bản",
      oldTitle: "Giai thuat va cau truc du lieu can ban",
      description: "Tổng hợp cây, đồ thị và các thuật toán sắp xếp.",
      schoolId: bachKhoa.id,
      subjectId: subjects["cau-truc-du-lieu"].id,
      documentType: DocumentType.LECTURE,
      pages: 84,
      downloads: 1250,
      fileUrl: "https://res.cloudinary.com/dyvfwtzz0/raw/upload/v1780649422/academic-documents/650034331-WebGoat-SQL-Injection-Introduction-1780649419022.pdf",
    },
    {
      title: "Đề thi cuối kỳ Xác suất thống kê 2025",
      oldTitle: "De thi cuoi ky Xac suat thong ke 2025",
      description: "Bộ đề ôn tập kèm đáp án tham khảo.",
      schoolId: kinhTe.id,
      subjectId: subjects["xac-suat-thong-ke"].id,
      documentType: DocumentType.EXAM,
      pages: 18,
      downloads: 930,
    },
    {
      title: "Tóm tắt Lập trình Web với React",
      oldTitle: "Tom tat Lap trinh Web voi React",
      description: "Ghi chú component, hooks và quản lý trạng thái.",
      schoolId: fpt.id,
      subjectId: subjects["lap-trinh-web"].id,
      documentType: DocumentType.NOTE,
      pages: 42,
      downloads: 720,
    },
    {
      title: "Bài tập thực hành Cơ sở dữ liệu",
      oldTitle: "Bai tap thuc hanh Co so du lieu",
      description: "Mô hình quan hệ, truy vấn SQL và chuẩn hóa dữ liệu.",
      schoolId: bachKhoa.id,
      subjectId: subjects["co-so-du-lieu"].id,
      documentType: DocumentType.ASSIGNMENT,
      pages: 35,
      downloads: 488,
    },
    {
      title: "Đề cương Marketing căn bản",
      oldTitle: "De cuong Marketing can ban",
      description: "Kiến thức trọng tâm và câu hỏi ôn thi.",
      schoolId: kinhTe.id,
      subjectId: subjects.marketing.id,
      documentType: DocumentType.LECTURE,
      pages: 56,
      downloads: 614,
    },
    {
      title: "Tài liệu tham khảo Tiếng Anh học thuật",
      oldTitle: "Tai lieu tham khao Tieng Anh hoc thuat",
      description: "Mẫu viết luận và từ vựng theo chủ đề.",
      schoolId: ngoaiThuong.id,
      subjectId: subjects["tieng-anh"].id,
      documentType: DocumentType.OTHER,
      pages: 67,
      downloads: 301,
    },
    {
      title: "Nhập môn SQL và thiết kế cơ sở dữ liệu",
      oldTitle: "Nhap mon SQL va thiet ke co so du lieu",
      description: "Hướng dẫn truy vấn SQL, khóa chính, khóa ngoại và chỉ mục.",
      schoolId: bachKhoa.id,
      subjectId: subjects["co-so-du-lieu"].id,
      documentType: DocumentType.LECTURE,
      pages: 73,
      downloads: 842,
    },
    {
      title: "Bộ bài tập React Hooks nâng cao",
      oldTitle: "Bo bai tap React Hooks nang cao",
      description: "Bài tập thực hành useEffect, useMemo, custom hook và form.",
      schoolId: fpt.id,
      subjectId: subjects["lap-trinh-web"].id,
      documentType: DocumentType.ASSIGNMENT,
      pages: 29,
      downloads: 536,
    },
    {
      title: "Tổng hợp công thức Xác suất thống kê",
      oldTitle: "Tong hop cong thuc Xac suat thong ke",
      description: "Bảng công thức phân phối, ước lượng và kiểm định giả thuyết.",
      schoolId: kinhTe.id,
      subjectId: subjects["xac-suat-thong-ke"].id,
      documentType: DocumentType.NOTE,
      pages: 24,
      downloads: 698,
    },
    {
      title: "Đề thi thử Tiếng Anh đầu ra",
      oldTitle: "De thi thu Tieng Anh dau ra",
      description: "Bộ đề luyện đọc hiểu, ngữ pháp và viết luận ngắn.",
      schoolId: ngoaiThuong.id,
      subjectId: subjects["tieng-anh"].id,
      documentType: DocumentType.EXAM,
      pages: 32,
      downloads: 457,
    },
    {
      title: "Hướng dẫn làm đồ án Lập trình Web",
      oldTitle: "Huong dan lam do an Lap trinh Web",
      description: "Quy trình phân tích yêu cầu, thiết kế giao diện và triển khai API.",
      schoolId: fpt.id,
      subjectId: subjects["lap-trinh-web"].id,
      documentType: DocumentType.LECTURE,
      pages: 64,
      downloads: 512,
    },
    {
      title: "100 câu hỏi trắc nghiệm Cơ sở dữ liệu",
      oldTitle: "100 cau hoi trac nghiem Co so du lieu",
      description: "Bộ câu hỏi ôn tập về ERD, SQL, transaction và chuẩn hóa.",
      schoolId: bachKhoa.id,
      subjectId: subjects["co-so-du-lieu"].id,
      documentType: DocumentType.EXAM,
      pages: 28,
      downloads: 774,
    },
    {
      title: "Bài giảng cây nhị phân và hàng đợi ưu tiên",
      oldTitle: "Bai giang cay nhi phan va hang doi uu tien",
      description: "Nội dung lý thuyết và ví dụ cài đặt bằng TypeScript.",
      schoolId: bachKhoa.id,
      subjectId: subjects["cau-truc-du-lieu"].id,
      documentType: DocumentType.LECTURE,
      pages: 52,
      downloads: 683,
    },
    {
      title: "Case study chiến lược Marketing số",
      oldTitle: "Case study chien luoc Marketing so",
      description: "Phân tích chiến dịch, hành trình khách hàng và KPI truyền thông.",
      schoolId: kinhTe.id,
      subjectId: subjects.marketing.id,
      documentType: DocumentType.NOTE,
      pages: 46,
      downloads: 429,
    },
    {
      title: "Mẫu báo cáo thực tập ngành CNTT",
      oldTitle: "Mau bao cao thuc tap nganh CNTT",
      description: "Khung trình bày báo cáo, mục lục và các phần nội dung cần có.",
      schoolId: fpt.id,
      subjectId: subjects["lap-trinh-web"].id,
      documentType: DocumentType.OTHER,
      pages: 38,
      downloads: 590,
    },
    {
      title: "Phương pháp giải bài tập xác suất có điều kiện",
      oldTitle: "Phuong phap giai bai tap xac suat co dieu kien",
      description: "Tổng hợp dạng bài Bayes, biến cố độc lập và bảng phân phối.",
      schoolId: kinhTe.id,
      subjectId: subjects["xac-suat-thong-ke"].id,
      documentType: DocumentType.ASSIGNMENT,
      pages: 31,
      downloads: 622,
    },
    {
      title: "Từ vựng Tiếng Anh học thuật theo chủ đề",
      oldTitle: "Tu vung Tieng Anh hoc thuat theo chu de",
      description: "Danh sách từ vựng, collocation và bài tập ứng dụng.",
      schoolId: ngoaiThuong.id,
      subjectId: subjects["tieng-anh"].id,
      documentType: DocumentType.NOTE,
      pages: 44,
      downloads: 389,
    },
    {
      title: "Đề cương ôn tập Cấu trúc dữ liệu giữa kỳ",
      oldTitle: "De cuong on tap Cau truc du lieu giua ky",
      description: "Tổng hợp danh sách liên kết, stack, queue, tree và graph.",
      schoolId: bachKhoa.id,
      subjectId: subjects["cau-truc-du-lieu"].id,
      documentType: DocumentType.EXAM,
      pages: 22,
      downloads: 803,
    },
    {
      title: "Checklist tối ưu UX cho website học tập",
      oldTitle: "Checklist toi uu UX cho website hoc tap",
      description: "Danh sách kiểm tra điều hướng, form, khả năng đọc và responsive.",
      schoolId: fpt.id,
      subjectId: subjects["lap-trinh-web"].id,
      documentType: DocumentType.OTHER,
      pages: 19,
      downloads: 344,
    },
    {
      title: "Bài tập lớn phân tích dữ liệu Marketing",
      oldTitle: "Bai tap lon phan tich du lieu Marketing",
      description: "Hướng dẫn thu thập dữ liệu, phân khúc người dùng và báo cáo insight.",
      schoolId: kinhTe.id,
      subjectId: subjects.marketing.id,
      documentType: DocumentType.ASSIGNMENT,
      pages: 58,
      downloads: 471,
    },
  ];

  for (const document of documents) {
    const existing = await prisma.document.findFirst({
      where: { title: { in: [document.title, document.oldTitle] }, uploaderId: userId },
    });
    const data = {
      schoolId: document.schoolId,
      subjectId: document.subjectId,
      title: document.title,
      description: document.description,
      documentType: document.documentType,
      status: DocumentStatus.APPROVED,
      downloadCount: document.downloads,
      viewCount: document.downloads * 3,
      approvedBy: approverId,
      approvedAt: new Date(),
    };
    let fileUrl = `https://example.com/documents/${encodeURIComponent(document.title)}.pdf`;
    
    // Use custom file URL if provided
    if (document.fileUrl) {
      fileUrl = document.fileUrl;
    }

    const file = {
      fileUrl: fileUrl,
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
  const { admin, users } = await seedUsers();
  const catalogs = await seedCatalog();
  await seedPlans();
  await seedDocuments(users[0].id, admin.id, catalogs);

  console.log("Seed completed.");
  console.log(`Admin: ${admin.email} / ${demoPassword}`);
  console.log("Users:");
  for (const user of users) {
    console.log(`- ${user.email} / ${demoPassword}`);
  }
  console.log(`Documents uploaded by: ${users[0].email}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
