"""
Name: search_tool.py
Intro: 搜索指定目录下的文件或内容
Usage: 
    查找文件：D 盘下 release/dist 里的 cfhlist.js
    python3 search_tool.py --mode "file" --root "D:\\" --file "cfhlist.js" --folders release dist

    查找内容：D 盘下 src 里包含 xfs_token 的文件
    python3 search_tool.py --mode "content" --root "D:\\" --content "xfs_token"  --folders src
Author: Zendu

"""


import os
import argparse
import sys
import time

def print_progress(iteration, total, prefix='扫描进度', suffix='完成', length=35, fill='█'):
    """单行动态进度条，不刷屏"""
    filled_length = int(length * iteration // total)
    bar = fill * filled_length + '-' * (length - filled_length)
    percent = f"{100 * iteration / total:.1f}"
    sys.stdout.write(f'\r{prefix} |{bar}| {percent}% {suffix}')
    sys.stdout.flush()

def search_file(root, target_file, target_folders, exclude_dirs):
    found = []
    all_dirs = []
    
    # 先统计总文件夹数量（用于进度条）
    for dirpath, dirnames, _ in os.walk(root):
        dirnames[:] = [d for d in dirnames if d not in exclude_dirs]
        all_dirs.append(dirpath)
    total = len(all_dirs)
    current = 0

    print(f"\n总文件夹数：{total}")
    start_time = time.time()

    # 正式扫描
    for dirpath, dirnames, filenames in os.walk(root):
        dirnames[:] = [d for d in dirnames if d not in exclude_dirs]
        print_progress(current, total)
        current += 1

        if any(f in dirpath.split(os.sep) for f in target_folders):
            if target_file in filenames:
                found.append(os.path.join(dirpath, target_file))

    print_progress(total, total)
    print(f"\n耗时：{round(time.time() - start_time, 2)}s")
    return found

def search_content(root, content, target_folders, exclude_dirs):
    found = []
    all_dirs = []

    # 统计总数
    for dirpath, dirnames, _ in os.walk(root):
        dirnames[:] = [d for d in dirnames if d not in exclude_dirs]
        all_dirs.append(dirpath)
    total = len(all_dirs)
    current = 0

    print(f"\n总文件夹数：{total}")
    start_time = time.time()

    # 扫描内容
    for dirpath, dirnames, filenames in os.walk(root):
        dirnames[:] = [d for d in dirnames if d not in exclude_dirs]
        print_progress(current, total)
        current += 1

        if any(f in dirpath.split(os.sep) for f in target_folders):
            for fn in filenames:
                fp = os.path.join(dirpath, fn)
                try:
                    try:
                        with open(fp, "r", encoding="utf-8") as f:
                            if content in f.read():
                                found.append(fp)
                    except:
                        with open(fp, "r", encoding="gbk") as f:
                            if content in f.read():
                                found.append(fp)
                except:
                    continue

    print_progress(total, total)
    print(f"\n耗时：{round(time.time() - start_time, 2)}s")
    return found

def main():
    parser = argparse.ArgumentParser(description="动态进度条查找工具")
    parser.add_argument("--mode", required=True, choices=["file", "content"])
    parser.add_argument("--root", required=True, help="根目录")
    parser.add_argument("--file", help="要查找的文件名")
    parser.add_argument("--content", help="要查找的内容")
    parser.add_argument("--folders", nargs="+", required=True, help="只在这些文件夹下查找")
    parser.add_argument("--exclude", nargs="+", default=["node_modules", ".git", "venv", "test"])

    args = parser.parse_args()

    print("=" * 60)
    print(f"▷ 根目录：{args.root}")
    print(f"▷ 查找目录：{args.folders}")
    print(f"▷ 排除目录：{args.exclude}")

    if args.mode == "file":
        print(f"⇢ 查找文件：{args.file}")
        res = search_file(args.root, args.file, args.folders, args.exclude)
    else:
        print(f"⇢ 查找内容：{args.content}")
        res = search_content(args.root, args.content, args.folders, args.exclude)

    print("-" * 60)
    if res:
        print(f"\n✅ 找到 {len(res)} 个结果：")
        for p in res:
            print(p)
    else:
        print("\n❌ 未找到匹配项")

if __name__ == "__main__":
    main()


#  查找文件：D 盘下 release/dist 里的 cfhlist.js
# python3 search_tool.py --mode "file" --root "D:\\" --file "cfhlist.js" --folders release dist


""" 
查找内容：D 盘下 src 里包含 xfs_token 的文件

$  python3 search_tool.py --mode "content" --root "D:\\" --content "maxAmmountPic"  --folders src
============================================================
▷ 根目录：D:\
▷ 查找目录：['src']
▷ 排除目录：['node_modules', '.git', 'venv', 'test']
⇢ 查找内容：maxAmmountPic

总文件夹数：4621
扫描进度 |███████████████████████████████████| 100.0% 完成
耗时：84.29s
------------------------------------------------------------

✅ 找到 3 个结果：
D:\help_app\src\component\report\littleCom\wgdm\wgdmProof.ts
D:\help_app\src\component\report\proof\proof.ts
D:\help_wap\src\component\report\proof\proof.ts
"""