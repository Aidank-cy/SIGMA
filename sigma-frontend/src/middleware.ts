import createMiddleware from "next-intl/middleware";

export default createMiddleware({
  defaultLocale: "zh",
  locales: ["zh", "en"]
});

export const config = {
  matcher: ["/", "/(zh|en)/:path*"]
};
