import type { NextConfig } from "next";

const repository = process.env.GITHUB_REPOSITORY?.split("/")[1] ?? "";
const isProjectSite = Boolean(repository && !repository.endsWith(".github.io"));

const nextConfig: NextConfig = {
  output: "export",
  trailingSlash: true,
  images: { unoptimized: true },
  basePath: isProjectSite ? `/${repository}` : "",
  assetPrefix: isProjectSite ? `/${repository}/` : "",
};

export default nextConfig;
