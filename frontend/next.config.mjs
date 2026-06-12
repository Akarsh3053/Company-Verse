/** @type {import('next').NextConfig} */
const nextConfig = {
  // Phaser owns an imperative <canvas> game instance and gains nothing from
  // React StrictMode's dev-only double-mount — which instead races the game's
  // async teardown/recreate and can freeze the boot loader. Disabling it is the
  // standard Phaser + Next.js integration practice. (No effect in production.)
  reactStrictMode: false,
};

export default nextConfig;
