// true  = dùng dữ liệu giả lập trong code (lưu bằng AsyncStorage để giả lập server)
// false = gọi mockapi.io thật -> dán URL project của bạn vào BASE_URL
export const USE_MOCK = true;
export const BASE_URL = 'https://YOUR_PROJECT_ID.mockapi.io/api/v1';
// Tăng số này nếu bạn sửa seed.js và muốn app nạp lại dữ liệu mẫu mới
export const SEED_VERSION = 1;
export const SESSION_KEY = 'furworld:session';
