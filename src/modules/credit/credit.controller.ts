import { RequestHandler } from "express";
import { sendSuccess } from "../../utils/response";
import { creditService } from "./credit.service";

/** Trả về số dư credit hiện tại của người dùng. */
export const balance: RequestHandler = async (req, res, next) => {
  try {
    sendSuccess(res, await creditService.balance(req.user!.userId));
  } catch (error) {
    next(error);
  }
};

/** Trả về lịch sử giao dịch credit của người dùng. */
export const transactions: RequestHandler = async (req, res, next) => {
  try {
    sendSuccess(
      res,
      await creditService.transactions(
        req.user!.userId,
        Number(req.query.page),
        Number(req.query.limit),
        req.query.documentId ? Number(req.query.documentId) : undefined,
      ),
    );
  } catch (error) {
    next(error);
  }
};

/** Cho admin điều chỉnh credit của một user. */
export const adminAdjust: RequestHandler = async (req, res, next) => {
  try {
    sendSuccess(res, await creditService.adminAdjust(req.body.userId, req.body.amount));
  } catch (error) {
    next(error);
  }
};
