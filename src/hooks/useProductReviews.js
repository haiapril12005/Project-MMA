import { useCallback, useEffect, useState } from 'react';
import { api } from '../api';

const LOAD_ERROR = 'Không tải được đánh giá. Kiểm tra kết nối rồi thử lại.';

const reviewErrorMessage = (error) => {
  const message = String(error?.message || '');
  if (message.includes('REVIEW_PURCHASE_REQUIRED')) return 'Chỉ khách hàng có đơn đã giao mới được đánh giá sản phẩm này.';
  if (message.includes('REVIEW_RATE_LIMIT')) return 'Bạn thao tác quá nhanh. Vui lòng chờ 60 giây rồi thử lại.';
  if (message.includes('REVIEW_COMMENT_LENGTH_INVALID')) return 'Nội dung đánh giá cần từ 10 đến 1.000 ký tự.';
  if (message.includes('REVIEW_LINK_NOT_ALLOWED')) return 'Đánh giá không được chứa đường link quảng cáo.';
  if (message.includes('REVIEW_NOT_FOUND')) return 'Không tìm thấy đánh giá để xóa.';
  return 'Không lưu được đánh giá. Vui lòng thử lại sau.';
};

// Đánh giá của một sản phẩm: danh sách, quyền viết (chỉ người đã nhận hàng) và lưu/xóa.
// save/remove ném Error với câu tiếng Việt để màn hình hiển thị.
export function useProductReviews(productId, userId) {
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const [canReview, setCanReview] = useState(false);
  const [eligibilityLoading, setEligibilityLoading] = useState(Boolean(userId));

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    api.reviews.byProduct(productId)
      .then((list) => { if (active) setReviews(list); })
      .catch(() => { if (active) setError(LOAD_ERROR); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [productId, reloadKey]);

  useEffect(() => {
    let active = true;
    if (!userId) {
      setCanReview(false);
      setEligibilityLoading(false);
      return () => { active = false; };
    }
    setEligibilityLoading(true);
    api.reviews.canReview(productId)
      .then((allowed) => { if (active) setCanReview(allowed); })
      .catch(() => { if (active) setCanReview(false); })
      .finally(() => { if (active) setEligibilityLoading(false); });
    return () => { active = false; };
  }, [productId, userId]);

  const retry = useCallback(() => setReloadKey((key) => key + 1), []);

  // Đã lưu/xóa thành công thì tải lại danh sách; tải lại lỗi chỉ báo ở phần danh sách
  const refresh = async () => {
    try {
      setReviews(await api.reviews.byProduct(productId));
      setError('');
    } catch (e) {
      setError(LOAD_ERROR);
    }
  };

  const save = async ({ rating, comment }) => {
    try {
      await api.reviews.save({ productId, rating, comment });
    } catch (e) {
      throw new Error(reviewErrorMessage(e));
    }
    await refresh();
  };

  const remove = async (reviewId) => {
    try {
      await api.reviews.remove(reviewId);
    } catch (e) {
      throw new Error(reviewErrorMessage(e));
    }
    await refresh();
  };

  return { reviews, loading, error, retry, canReview, eligibilityLoading, save, remove };
}
