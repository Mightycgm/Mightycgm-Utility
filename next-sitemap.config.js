/** @type {import('next-sitemap').IConfig} */
module.exports = {
  siteUrl: "https://mightycgm.github.io/Mightycgm-Utility",
  generateRobotsTxt: true,
  outDir: "./out",
  robotsTxtOptions: {
    policies: [
      { userAgent: "*", allow: "/" },
    ],
  },
};
