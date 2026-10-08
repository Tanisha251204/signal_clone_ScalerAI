export const API_URL = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000").replace(/\/$/, "");
export const WS_URL = (process.env.NEXT_PUBLIC_WS_URL || API_URL.replace(/^http/, "ws")).replace(/\/$/, "");
export const OTP_HINT = "123456";
export const TOKEN_KEY = "signal.token";
export const THEME_KEY = "signal.theme";
export const PREFS_KEY = "signal.prefs";
