import type { NextConfig } from "next";
import { withContentCollections } from "@content-collections/next";

const nextConfig = {
	// Lets an isolated test server run beside the main dev server (separate lock/cache).
	distDir: process.env.AI_EDITA_NEXT_DIST_DIR || ".next",
	devIndicators: false,
	compiler: {
		removeConsole: process.env.NODE_ENV === "production",
	},
	reactStrictMode: true,
	productionBrowserSourceMaps:
		process.env.NEXT_PUBLIC_AI_EDITA_LOCAL_MODE !== "1",
	// Remotion's renderer and bundler load platform-specific binaries at runtime.
	// Keeping them external prevents Turbopack from trying to resolve binaries for
	// every OS while still allowing Next's standalone tracer to copy the package.
	serverExternalPackages: ["@remotion/bundler", "@remotion/renderer"],
	output: "standalone",
	images: {
		// Portable builds must stay platform-neutral so the same standalone app
		// can be paired with the official Windows or macOS runtime.
		unoptimized: process.env.NEXT_PUBLIC_AI_EDITA_LOCAL_MODE === "1",
		remotePatterns: [
			{
				protocol: "https",
				hostname: "plus.unsplash.com",
			},
			{
				protocol: "https",
				hostname: "images.unsplash.com",
			},
			{
				protocol: "https",
				hostname: "images.marblecms.com",
			},
			{
				protocol: "https",
				hostname: "lh3.googleusercontent.com",
			},
			{
				protocol: "https",
				hostname: "avatars.githubusercontent.com",
			},
			{
				protocol: "https",
				hostname: "api.iconify.design",
			},
			{
				protocol: "https",
				hostname: "api.simplesvg.com",
			},
			{
				protocol: "https",
				hostname: "api.unisvg.com",
			},
			{
				protocol: "https",
				hostname: "cdn.brandfetch.io",
			},
		],
	},
} satisfies NextConfig;

export default withContentCollections(nextConfig);
