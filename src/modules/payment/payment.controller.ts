import { RequestHandler } from "express";
import { env } from "../../config/env";
import { sendSuccess } from "../../utils/response";
import { paymentService } from "./payment.service";

/** Tạo thanh toán mới cho gói premium. */
export const create: RequestHandler = async (req, res, next) => {
  try { sendSuccess(res, await paymentService.create(req.user!.userId, req.body.planId, req.body.method, req.ip), 201); } catch (error) { next(error); }
};
/** Xác nhận thanh toán giả lập cho môi trường dev. */
export const mockConfirm: RequestHandler = async (req, res, next) => {
  try { sendSuccess(res, await paymentService.mockConfirm(req.user!.userId, Number(req.params.id))); } catch (error) { next(error); }
};
/** Lấy lịch sử thanh toán của user. */
export const history: RequestHandler = async (req, res, next) => {
  try { sendSuccess(res, await paymentService.history(req.user!.userId, Number(req.query.page), Number(req.query.limit))); } catch (error) { next(error); }
};

/** Xử lý URL return từ VNPAY và chuyển hướng về frontend. */
export const vnpayReturn: RequestHandler = async (req, res, next) => {
  try {
    const query = req.query as Record<string, unknown>;
    const result = await paymentService.vnpayReturn(Number(query.vnp_TxnRef), {
        ...Object.fromEntries(Object.entries(query).map(([k, v]) => [k, String(v)])),
        vnp_ResponseCode: String(query.vnp_ResponseCode),
        vnp_SecureHash: String(query.vnp_SecureHash),
      });
    res.redirect(`${env.FRONTEND_URL}/gioi-thieu/payment/${result.success ? "success" : "failed"}?paymentId=${result.paymentId}`);
  } catch (error) {
    res.redirect(`${env.FRONTEND_URL}/gioi-thieu/payment/failed`);
  }
};

/** Xử lý IPN callback từ VNPAY. */
export const vnpayIpn: RequestHandler = async (req, res) => {
  try {
    const query = req.query as Record<string, unknown>;
    const result = await paymentService.vnpayIpn(Number(query.vnp_TxnRef), {
      ...Object.fromEntries(Object.entries(query).map(([k, v]) => [k, String(v)])),
      vnp_ResponseCode: String(query.vnp_ResponseCode),
      vnp_SecureHash: String(query.vnp_SecureHash),
    });
    res.status(200).json({
      RspCode: result.alreadyProcessed ? "02" : "00",
      Message: result.alreadyProcessed ? "Order already confirmed" : "Confirm Success",
    });
  } catch (error) {
    res.status(200).json({ RspCode: "99", Message: "Confirm Fail" });
  }
};
