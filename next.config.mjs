import withPWAInit from "@ducanh2912/next-pwa";

const nextConfig = {
    output: "standalone",
    serverExternalPackages: ["sqlite-vec"],
    turbopack: {},
};

const withPWA = withPWAInit({
    dest: "public",
    disable: process.env.NODE_ENV === "development",
    register: true,
    skipWaiting: true,
});

export default withPWA(nextConfig);
