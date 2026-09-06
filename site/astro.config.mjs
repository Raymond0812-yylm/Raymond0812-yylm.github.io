import { defineConfig } from 'astro/config';

// 正式站点:GitHub Pages 个人主页仓库(Raymond0812-yylm.github.io),挂在域名根路径
// 构建产物输出到工作区根目录的 docs/,GitHub Pages 配置为 "main 分支 /docs 目录" 发布
export default defineConfig({
  site: 'https://raymond0812-yylm.github.io',
  outDir: '../docs',
  output: 'static',
  trailingSlash: 'ignore',
  build: { format: 'directory' },
});
