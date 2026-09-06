import { defineConfig } from 'astro/config';

// 正式站点:自定义域名 quantopt.yylm.com(CNAME 指向 Raymond0812-yylm.github.io)
// 构建产物输出到工作区根目录的 docs/,GitHub Pages 配置为 "main 分支 /docs 目录" 发布
export default defineConfig({
  site: 'https://quantopt.yylm.com',
  outDir: '../docs',
  output: 'static',
  trailingSlash: 'ignore',
  build: { format: 'directory' },
});
