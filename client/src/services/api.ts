import axios from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";

const SERVER = Platform.OS === "web" ? "" : "http://124.222.230.80:3000";
const BASE_URL = `${SERVER}/api/v1`;

export function fixImageUrl(url: string): string {
  if (!url) return "";
  if (url.startsWith("http")) return url;
  // Web端使用相对路径即可——同源部署，浏览器自动拼完整URL
  // （若nginx未代理/uploads，需在nginx加：location /uploads/ { proxy_pass http://127.0.0.1:3000; }）
  if (Platform.OS === "web") return url;
  return `${SERVER}${url}`;
}

const api = axios.create({
  baseURL: BASE_URL,
  timeout: 15000,
});

// 请求拦截器：自动注入Token + 智能设Content-Type
api.interceptors.request.use(async (config) => {
  const token = await AsyncStorage.getItem("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  // 只有普通对象才设JSON头，文件上传让浏览器自动设boundary
  const isForm = config.data && typeof config.data === "object" && (config.data instanceof FormData || config.data._parts || config.data.append);
  if (!config.headers["Content-Type"] && !isForm) {
    config.headers["Content-Type"] = "application/json";
  }
  if (isForm) delete config.headers["Content-Type"];
  return config;
});

// 响应拦截器：统一错误处理
api.interceptors.response.use(
  (response) => response.data,
  (error) => {
    if (error.response?.status === 401) {
      // Token过期，可在此触发登出
      AsyncStorage.removeItem("token");
    }
    return Promise.reject(error.response?.data || error);
  }
);

export default api;
