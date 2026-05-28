import { prisma } from "../../database/prisma";
import { DocumentStatus, PaymentStatus } from "@prisma/client";

export const dashboardRepository = {
  getOverviewStats: async () => {
    const [userCount, documentCount, downloadCount, revenueResult] = await Promise.all([
      prisma.user.count({ where: { deletedAt: null } }),
      prisma.document.count({ where: { status: DocumentStatus.APPROVED, deletedAt: null } }),
      prisma.download.count(),
      prisma.payment.aggregate({
        where: { status: PaymentStatus.PAID },
        _sum: { amount: true },
      }),
    ]);

    return {
      totalUsers: userCount,
      totalDocuments: documentCount,
      totalDownloads: downloadCount,
      totalRevenue: revenueResult._sum.amount ?? 0,
    };
  },

  getTimeSeriesStats: async (startDate: Date, endDate: Date) => {
    // Truy vấn dữ liệu đăng ký user theo ngày
    const usersByDay = await prisma.$queryRaw<Array<{ date: Date; count: number }>>`
      SELECT DATE_TRUNC('day', created_at) AS date, COUNT(*)::int AS count 
      FROM users 
      WHERE deleted_at IS NULL AND created_at >= ${startDate} AND created_at <= ${endDate}
      GROUP BY date 
      ORDER BY date ASC
    `;

    // Truy vấn số tài liệu được approved theo ngày
    const documentsByDay = await prisma.$queryRaw<Array<{ date: Date; count: number }>>`
      SELECT DATE_TRUNC('day', approved_at) AS date, COUNT(*)::int AS count 
      FROM documents 
      WHERE status = 'APPROVED' AND deleted_at IS NULL AND approved_at >= ${startDate} AND approved_at <= ${endDate}
      GROUP BY date 
      ORDER BY date ASC
    `;

    // Truy vấn số lượt download theo ngày
    const downloadsByDay = await prisma.$queryRaw<Array<{ date: Date; count: number }>>`
      SELECT DATE_TRUNC('day', downloaded_at) AS date, COUNT(*)::int AS count 
      FROM downloads 
      WHERE downloaded_at >= ${startDate} AND downloaded_at <= ${endDate}
      GROUP BY date 
      ORDER BY date ASC
    `;

    // Truy vấn doanh thu theo ngày
    const revenueByDay = await prisma.$queryRaw<Array<{ date: Date; revenue: number }>>`
      SELECT DATE_TRUNC('day', paid_at) AS date, SUM(amount)::float AS revenue 
      FROM payments 
      WHERE status = 'PAID' AND paid_at >= ${startDate} AND paid_at <= ${endDate}
      GROUP BY date 
      ORDER BY date ASC
    `;

    return {
      usersByDay,
      documentsByDay,
      downloadsByDay,
      revenueByDay,
    };
  },

  getTopCharts: async () => {
    const [topDocuments, topSchools] = await Promise.all([
      prisma.document.findMany({
        where: { status: DocumentStatus.APPROVED, deletedAt: null },
        orderBy: { downloadCount: "desc" },
        take: 5,
        select: {
          id: true,
          title: true,
          downloadCount: true,
          viewCount: true,
          uploader: { select: { fullName: true } },
        },
      }),
      prisma.school.findMany({
        where: { deletedAt: null },
        select: {
          id: true,
          name: true,
          _count: {
            select: {
              documents: {
                where: { status: DocumentStatus.APPROVED, deletedAt: null },
              },
            },
          },
        },
        orderBy: {
          documents: { _count: "desc" },
        },
        take: 5,
      }),
    ]);

    return {
      topDocuments,
      topSchools: topSchools.map((s) => ({
        id: s.id,
        name: s.name,
        documentCount: s._count.documents,
      })),
    };
  },
};
