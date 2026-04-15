# Code Viewer (Pure Frontend)

> https://code-explorer-y3st.vercel.app/

This project allows you to showcase your code source files in a beautiful, card-based interface.

## WebDesgin

![](./assets/1.png)
![](./assets/2.png)
![](./assets/3.png)

## How to use

1.  **Place your single files** in `public/shortSource/`.
2.  **Place your directories** in `public/longSource/`.
3.  **Update `src/data.ts`** to include the paths to your files and folders.

### Data Format in `src/data.ts`

```typescript
export const shortSource: FileItem[] = [
  {
    name: 'your-file.js',
    path: '/shortSource/your-file.js',
    type: 'file',
  },
];

export const longSource: FileItem[] = [
  {
    name: 'your-folder',
    path: '/longSource/your-folder',
    type: 'directory',
    children: [
      {
        name: 'sub-file.ts',
        path: '/longSource/your-folder/sub-file.ts',
        type: 'file',
      },
    ],
  },
];
```

## Features

- **Card View**: Clean cards for files and folders.
- **Syntax Highlighting**: Prism-based code viewing for various languages.
- **Navigation**: Click folders to dive deeper, use breadcrumbs to go back.
- **Download**: Download any file directly from the card or modal.
- **Pure Frontend**: No backend required; can be hosted on GitHub Pages, Vercel, etc.

## Setup

```bash
npm install
npm run dev
```
