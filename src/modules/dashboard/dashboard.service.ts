import { dashboardRepository } from "./dashboard.repository";

export const dashboardService = {
  /** Tổng hợp thống kê dashboard theo khoảng ngày. */
  getStats: async (start?: string, end?: string) => {
    // Mặc định thống kê trong 30 ngày gần nhất.
    const endDate = end ? new Date(end) : new Date();
    const startDate = start ? new Date(start) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    // Lấy trọn ngày theo khoảng lọc.
    startDate.setHours(0, 0, 0, 0);
    endDate.setHours(23, 59, 59, 999);

    const [overview, timeSeries, topCharts] = await Promise.all([
      dashboardRepository.getOverviewStats(),
      dashboardRepository.getTimeSeriesStats(startDate, endDate),
      dashboardRepository.getTopCharts(),
    ]);

    // Chuẩn hóa ngày trong time-series về YYYY-MM-DD.
    const formatDate = (date: Date) => date.toISOString().split("T")[0];

    const formattedTimeSeries = {
      usersByDay: timeSeries.usersByDay.map((item) => ({
        date: formatDate(item.date),
        count: item.count,
      })),
      documentsByDay: timeSeries.documentsByDay.map((item) => ({
        date: formatDate(item.date),
        count: item.count,
      })),
      downloadsByDay: timeSeries.downloadsByDay.map((item) => ({
        date: formatDate(item.date),
        count: item.count,
      })),
      revenueByDay: timeSeries.revenueByDay.map((item) => ({
        date: formatDate(item.date),
        revenue: item.revenue,
      })),
    };

    return {
      overview,
      timeSeries: formattedTimeSeries,
      topCharts,
    };
  },
};
