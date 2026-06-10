import { RequestHandler } from "express";
import { sendSuccess } from "../../utils/response";
import { dashboardService } from "./dashboard.service";

/** Trả về dữ liệu thống kê tổng quan cho dashboard admin. */
export const getStats: RequestHandler = async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;
    const stats = await dashboardService.getStats(
      startDate as string | undefined,
      endDate as string | undefined
    );
    sendSuccess(res, stats);
  } catch (error) {
    next(error);
  }
};
