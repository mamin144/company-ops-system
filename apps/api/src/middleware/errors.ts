import type { ErrorRequestHandler, RequestHandler } from 'express';

export const notFoundHandler: RequestHandler = (_req, res) => {
  res.status(404).json({ message: 'Not found' });
};

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  let status = typeof err?.status === 'number' ? err.status : 500;
  let message: string = err?.message ?? 'Server error';
  // Map PostgreSQL error codes (which carry no .status) to proper HTTP
  // statuses instead of leaking 500s for client-caused input problems.
  if (typeof err?.status !== 'number' && typeof err?.code === 'string') {
    switch (err.code) {
      case '22P02': // invalid_text_representation, e.g. malformed UUID in id param
        status = 400;
        message = 'معرف غير صالح';
        break;
      case '23505': // unique_violation, e.g. duplicate project code
        status = 409;
        message = 'السجل موجود بالفعل (قيمة مكررة)';
        break;
      case '23503': // foreign_key_violation
        status = 400;
        message = 'مرجع غير موجود';
        break;
      case '23502': // not_null_violation (residual mapping bug surfacing)
        status = 400;
        message = 'بيانات ناقصة لحقل مطلوب';
        break;
    }
  }
  res.status(status).json({ message });
};
