/*
 * 自动读取 members 文件夹里的所有 .js 文件。
 *
 * eager: true
 * 表示页面加载时直接导入这些文件，
 * 不需要额外进行异步加载。
 */
const modules = import.meta.glob("./members/*.js", {
  eager: true,
});

/*
 * 获取所有成员的数据，
 * 并根据 order 排序。
 */
export const founders = Object.values(modules)
  .map((module) => module.default)
  .filter(Boolean)
  .sort(
    (a, b) =>
      (a.order ?? Number.MAX_SAFE_INTEGER) -
      (b.order ?? Number.MAX_SAFE_INTEGER)
  );