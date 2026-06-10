import { dashboardRepository } from "./dashboard.repository";

export const dashboardService = {
  getStats: async (start?: string, end?: string) => {
    // Mặc định thống kê trong vòng 30 ngày gần nhất nếu không truyền
    const endDate = end ? new Date(end) : new Date();
    const startDate = start ? new Date(start) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    // Thiết lập giờ bắt đầu ngày và kết thúc ngày
    startDate.setHours(0, 0, 0, 0);
    endDate.setHours(23, 59, 59, 999);

    const [overview, timeSeries, topCharts] = await Promise.all([
      dashboardRepository.getOverviewStats(),
      dashboardRepository.getTimeSeriesStats(startDate, endDate),
      dashboardRepository.getTopCharts(),
    ]);

    // Format ngày của dữ liệu time-series thành định dạng YYYY-MM-DD
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
