export interface FileItem {
  name: string;
  path: string;
  code: string;
  type: 'file' | 'directory';
  intro?: string;
  children?: FileItem[];
  star?: number
}

const getCode = (path: string) => {
  let hash = 5381;
  for (let i = 0; i < path.length; i++) {
    hash = (hash * 33) ^ path.charCodeAt(i);
  }
  return (hash >>> 0).toString(16);
};

// 自动扫描 shortSource 下的一级文件
const shortModules = import.meta.glob('/public/shortSource/*', { query: '?url' });
export const shortSource: FileItem[] = Object.keys(shortModules).map((key) => {
  const path = key.replace('/public', '').split('?')[0];
  return {
    name: key.split('/').pop()?.split('?')[0] || '',
    path,
    code: getCode(path),
    type: 'file',
  };
});

// 自动扫描 longSource 下的所有递归文件
const longModules = import.meta.glob('/public/longSource/**', { query: '?url' });

const buildTree = (): FileItem[] => {
  const root: FileItem[] = [];
  const paths = Object.keys(longModules);

  paths.forEach((fullPath) => {
    const webPath = fullPath.replace('/public', '');
    const parts = webPath.split('/').filter(Boolean);

    // 只处理 longSource 目录下的内容
    if (parts[0] !== 'longSource') return;

    const relativeParts = parts.slice(1);
    if (relativeParts.length === 0) return;

    let currentLevel = root;

    relativeParts.forEach((part, index) => {
      const isLast = index === relativeParts.length - 1;
      const currentPath = '/' + parts.slice(0, index + 2).join('/');

      let existingItem = currentLevel.find((item) => item.name === part);

      if (!existingItem) {
        existingItem = {
          name: part,
          path: currentPath,
          code: getCode(currentPath),
          type: isLast ? 'file' : 'directory',
          children: isLast ? undefined : [],
        };
        currentLevel.push(existingItem);
      }

      if (!isLast && existingItem.children) {
        currentLevel = existingItem.children;
      }
    });
  });

  return root;
};

export const longSource: FileItem[] = buildTree();
