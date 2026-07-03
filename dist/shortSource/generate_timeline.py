#Intro: 持仓时间图
#Prev: ../img/buyselltimeline.png
#Tag: 投资工具

#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
买入清仓时间线生成器
--------------------
在下面的 TRADES 列表里增删/修改你的交易记录，运行脚本即可生成同款 SVG 时间线图。

用法：
    python3 generate_timeline.py

输出：
    根据 OUTPUT_FORMAT 生成 .svg 或 .png，文件名前缀见 OUTPUT_FILE_BASE。
    PNG 需要额外安装一次： pip install resvg-py
    （用 resvg 而不是 cairosvg，是因为 resvg 是打包好的独立二进制，Windows下不会出现
    "找不到 libcairo-2.dll" 之类的系统库问题，中文字体候选列表也能正常识别。）

隐私开关：
    SHOW_AMOUNT = True   -> 显示利润金额（如"利润5.1万"）和仓位占比
    SHOW_AMOUNT = False  -> 只显示持仓时长和年化收益率，隐藏具体金额和仓位占比

配色开关：
    COLOR_BY_RETURN = True  -> 时间柱按年化收益率上色（红=年化高，白=接近0，绿=亏损）
    COLOR_BY_RETURN = False -> 所有已清仓的柱子统一用 COLOR_LINE 一种颜色（原来的效果）

输出格式开关：
    OUTPUT_FORMAT = "svg"  -> 生成矢量图，体积小、可无损缩放，适合再编辑
    OUTPUT_FORMAT = "png"  -> 生成位图，适合直接发朋友圈/聊天工具（多数聊天工具会压缩SVG导致显示异常）
"""

import math
from datetime import date

# ============================================================
# 1. 在这里控制是否显示金额 / 仓位占比
# ============================================================
SHOW_AMOUNT = True

# 是否按年化收益率给时间柱上色
COLOR_BY_RETURN = True

# 标的名称显示位置：
#   "left"       -> 固定在最左侧一列（原来的效果）
#   "bar_center" -> 显示在对应时间柱正上方、柱子的水平居中位置
NAME_POSITION = "left"

# 颜色映射的"半饱和点"：年化收益率达到这个值（正负各自）时颜色已经比较深了。
# 调大这个数会让色差更平缓，调小则更极端。
COLOR_SCALE_HALF = 0.6  # 0.6 = 年化±60%附近颜色已经比较深


# 只在 OUTPUT_FORMAT = "png" 时生效：清晰度/画质控制
# PNG_SCALE：放大倍数，越大图越清晰、文件也越大。
#   1 = 按SVG标注的像素尺寸原样导出（跟网页上看到的一样大，边缘可能有点糊）
#   2 = 双倍分辨率（默认，对应手机/Retina屏的清晰度，日常发朋友圈聊天工具够用）
#   3~4 = 高分辨率，适合投屏、打印或需要放大看细节的场合，文件也会明显变大
PNG_SCALE = 4


# 输出格式："svg" 或 "png"
OUTPUT_FORMAT = "png"


# ============================================================
# 2. 在这里维护你的交易记录
#    字段说明：
#      name         标的名称
#      buy_date     买入日期 "YYYY-MM-DD"
#      sell_date    清仓日期 "YYYY-MM-DD"；仍在持有则写 None
#      buy_amount   买入本金（万元）——用于自动算年化收益率；不显示金额也建议填，算完会自动隐藏
#      profit       利润（万元，亏损写负数）；只在已清仓时需要
#      annualized   如果不想让脚本自动算年化，可以直接在这里填百分比小数（如 0.28），
#                   留 None 则用 buy_amount + profit 自动算
#      position_pct 仅未清仓时用：当前仓位占比（%）
#      broke_even   仅未清仓时用：是否已回本 (True/False)
# ============================================================
TRADES = [
    {
        "name": "美团",
        "buy_date": "2023-02-17",
        "sell_date": "2024-06-14",
        "buy_amount": 13.2,
        "profit": 5.1,
        "annualized": None,
    },
    {
        "name": "牧原股份",
        "buy_date": "2023-05-05",
        "sell_date": "2024-10-10",
        "buy_amount": 34.5,
        "profit": 1.5,
        "annualized": None,
    },
    {
        "name": "中矿资源",
        "buy_date": "2024-04-25",
        "sell_date": "2026-05-08",
        "buy_amount": 64.4,
        "profit": 112.1,
        "annualized": None,
    },
    {
        "name": "药明生物",
        "buy_date": "2024-06-12",
        "sell_date": "2025-04-08",
        "buy_amount": 10.8,
        "profit": 8.6,
        "annualized": None,
    },
    # {
    #     "name": "传奇生物",
    #     "buy_date": "2025-06-04",
    #     "sell_date": None,          # 未清仓
    #     "position_pct": 25,
    #     "broke_even": True,
    # },
    {
        "name": "天齐锂业",
        "buy_date": "2026-03-12",
        "sell_date": "2026-05-18",
        "buy_amount": 134.1,
        "profit": 22.2,
        "annualized": None,
    },
]

# 图上"截至"日期（用于未清仓标的的当前点位）；默认今天
AS_OF_DATE = date.today()

TITLE = "买入到清仓时间线"


# 文件名前缀（不带后缀），脚本会根据 OUTPUT_FORMAT 自动加 .svg 或 .png
OUTPUT_FILE_BASE = "买入清仓时间线_生成"


# ============================================================
# 以下是绘图逻辑，一般不需要改动
# ============================================================

COLOR_BG = "#fbfbf8"
COLOR_TITLE = "#252525"
COLOR_SUBTITLE = "#626a73"
COLOR_GRID = "#ddd7ce"
COLOR_LINE = "#2f9e67"
COLOR_BUY = "#3976af"
COLOR_SELL = "#d67b2c"
COLOR_OPEN = "#8b9096"

FONT_STYLE = '<style>text{font-family:"PingFang SC","Microsoft YaHei","Noto Sans CJK SC","Arial Unicode MS",Arial,sans-serif;}</style>'

LEFT_MARGIN = 55
ROW_START_Y = 135
ROW_HEIGHT = 55
PLOT_X_END = 1300
RIGHT_LABEL_PAD = 18

# 时间轴起点的横坐标。"left"模式下名字要单独占一列，所以留白大一些；
# "bar_center"模式下名字浮在柱子上方，不需要额外留白，起点可以更靠左。
PLOT_X_START_LEFT = 170
PLOT_X_START_BAR_CENTER = 75
PLOT_X_START = PLOT_X_START_LEFT if NAME_POSITION == "left" else PLOT_X_START_BAR_CENTER


def parse_date(s):
    if s is None:
        return None
    y, m, d = map(int, s.split("-"))
    return date(y, m, d)


def fmt_pct(x):
    return f"{x*100:.0f}%"


# 中性色（接近0%时的颜色，和背景色相近但保留一点饱和度，避免完全隐形）
_NEUTRAL = (238, 232, 219)
_RED = (196, 42, 42)      # 年化收益率很高
_GREEN = (43, 140, 84)    # 年化收益率为负（亏损）


def _lerp_color(c0, c1, t):
    r = round(c0[0] + (c1[0] - c0[0]) * t)
    g = round(c0[1] + (c1[1] - c0[1]) * t)
    b = round(c0[2] + (c1[2] - c0[2]) * t)
    return f"#{r:02x}{g:02x}{b:02x}"


def ann_to_color(ann, half=COLOR_SCALE_HALF):
    """年化收益率(小数) -> 十六进制颜色。用 tanh 压缩，避免极端值把颜色直接冲到顶。"""
    t = math.tanh(ann / half)  # 落在 (-1, 1) 之间
    if t >= 0:
        return _lerp_color(_NEUTRAL, _RED, t)
    else:
        return _lerp_color(_NEUTRAL, _GREEN, -t)


def color_legend_svg(x_left, y_top, width=220, height=14, half=COLOR_SCALE_HALF):
    """画一条渐变图例条，带刻度文字。"""
    steps = 40
    parts = ['<g>']
    span = half * 2.2
    for i in range(steps):
        frac0 = i / steps
        frac1 = (i + 1) / steps
        ann0 = -span + frac0 * 2 * span
        ann1 = -span + frac1 * 2 * span
        ann_mid = (ann0 + ann1) / 2
        x0 = x_left + frac0 * width
        w = (frac1 - frac0) * width
        parts.append(f'<rect x="{x0:.2f}" y="{y_top}" width="{w:.2f}" height="{height}" fill="{ann_to_color(ann_mid, half)}"/>')
    for tick_pct in [-100, -50, 0, 50, 100, 150]:
        ann = tick_pct / 100
        if -span <= ann <= span:
            tx = x_left + (ann + span) / (2 * span) * width
            parts.append(f'<line x1="{tx:.2f}" y1="{y_top}" x2="{tx:.2f}" y2="{y_top+height}" stroke="#ffffff" stroke-width="1" opacity="0.6"/>')
            parts.append(f'<text x="{tx:.2f}" y="{y_top+height+16}" font-size="11" fill="#626a73" text-anchor="middle">{tick_pct}%</text>')
    parts.append('<text x="%.2f" y="%d" font-size="11" fill="#626a73" text-anchor="start">年化收益率</text>' % (x_left, y_top - 6))
    parts.append('</g>')
    return "".join(parts)


def compute_row(t):
    buy = parse_date(t["buy_date"])
    sell = parse_date(t.get("sell_date"))
    row = {"name": t["name"], "buy": buy, "sell": sell, "open": sell is None}

    if not row["open"]:
        held_days = (sell - buy).days
        held_years = held_days / 365.25
        ann = t.get("annualized")
        if ann is None:
            profit = t["profit"]
            cost = t["buy_amount"]
            ann = (1 + profit / cost) ** (1 / held_years) - 1 if held_years > 0 else 0.0
        row["held_years"] = held_years
        row["profit"] = t.get("profit")
        row["annualized"] = ann
        if SHOW_AMOUNT:
            row["label"] = f"{held_years:.2f}年｜利润{t['profit']}万｜年化{fmt_pct(ann)}"
        else:
            row["label"] = f"{held_years:.2f}年｜年化{fmt_pct(ann)}"
    else:
        row["end_point"] = AS_OF_DATE
        status = "已回本" if t.get("broke_even") else "未回本"
        if SHOW_AMOUNT and t.get("position_pct") is not None:
            row["label"] = f"未清仓｜{status}｜仓位{t['position_pct']}%"
        else:
            row["label"] = f"未清仓｜{status}"
    return row


def build_svg(rows):
    all_dates = []
    for r in rows:
        all_dates.append(r["buy"])
        all_dates.append(r["sell"] if not r["open"] else r["end_point"])

    min_year = min(d.year for d in all_dates)
    max_date = max(all_dates)
    max_year = max_date.year + 1

    year_list = list(range(min_year, max_year + 1))
    date0 = date(min_year, 1, 1)
    date_last = date(max_year, 1, 1)
    total_days = (date_last - date0).days
    px_per_day = (PLOT_X_END - PLOT_X_START) / total_days

    def x_of(d):
        return PLOT_X_START + (d - date0).days * px_per_day

    height = ROW_START_Y + ROW_HEIGHT * len(rows) + 70
    width = PLOT_X_END + 220

    svg = []
    svg.append(f'<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}" viewBox="0 0 {width} {height}">')
    svg.append(f'<rect width="100%" height="100%" fill="{COLOR_BG}"/>')
    svg.append(FONT_STYLE)
    svg.append(f'<text x="{LEFT_MARGIN}" y="58" font-size="28" font-weight="700" fill="{COLOR_TITLE}" text-anchor="start">{TITLE}</text>')

    if COLOR_BY_RETURN:
        subtitle = f"蓝点＝第一笔买入；橙点＝清仓；灰线＝未清仓，截至 {AS_OF_DATE.isoformat()}；柱色＝年化收益率（红高绿低，越深越极端）。"
    else:
        subtitle = f"蓝点＝第一笔买入；橙点＝清仓；灰线＝未清仓，截至 {AS_OF_DATE.isoformat()}。"
    svg.append(f'<text x="{LEFT_MARGIN}" y="88" font-size="15" fill="{COLOR_SUBTITLE}" text-anchor="start">{subtitle}</text>')

    if COLOR_BY_RETURN:
        svg.append(color_legend_svg(width - 260, 40, width=220, height=12))

    for y in year_list:
        gx = x_of(date(y, 1, 1))
        svg.append(f'<line x1="{gx:.2f}" y1="115" x2="{gx:.2f}" y2="{height-45}" stroke="{COLOR_GRID}" stroke-width="1" opacity="0.65" stroke-dasharray="3 5"/>')
        svg.append(f'<text x="{gx:.2f}" y="{height-20}" font-size="13" fill="{COLOR_SUBTITLE}" text-anchor="middle">{y}</text>')

    row_y = ROW_START_Y
    for r in rows:
        if NAME_POSITION == "left":
            svg.append(f'<text x="{LEFT_MARGIN}" y="{row_y+5}" font-size="16" font-weight="700" fill="{COLOR_TITLE}" text-anchor="start">{r["name"]}</text>')

        x_buy = x_of(r["buy"])
        if not r["open"]:
            x_end = x_of(r["sell"])
            bar_color = ann_to_color(r["annualized"]) if COLOR_BY_RETURN else COLOR_LINE
            svg.append(f'<line x1="{x_buy:.2f}" y1="{row_y}" x2="{x_end:.2f}" y2="{row_y}" stroke="{bar_color}" stroke-width="9" opacity="0.95"/>')
            svg.append(f'<circle cx="{x_buy:.2f}" cy="{row_y}" r="8" fill="{COLOR_BUY}" stroke="#fff" stroke-width="2"/>')
            svg.append(f'<circle cx="{x_end:.2f}" cy="{row_y}" r="8" fill="{COLOR_SELL}" stroke="#fff" stroke-width="2"/>')
            label_x = x_end + RIGHT_LABEL_PAD
        else:
            x_end = x_of(r["end_point"])
            svg.append(f'<line x1="{x_buy:.2f}" y1="{row_y}" x2="{x_end:.2f}" y2="{row_y}" stroke="{COLOR_OPEN}" stroke-width="9" opacity="0.9"/>')
            svg.append(f'<circle cx="{x_buy:.2f}" cy="{row_y}" r="8" fill="{COLOR_BUY}" stroke="#fff" stroke-width="2"/>')
            svg.append(f'<polygon points="{x_end:.2f},{row_y-8} {x_end-7.6:.2f},{row_y+6} {x_end+7.6:.2f},{row_y+6}" fill="{COLOR_OPEN}" stroke="#fff" stroke-width="2"/>')
            label_x = x_end + RIGHT_LABEL_PAD

        if NAME_POSITION == "bar_center":
            mid_x = (x_buy + x_end) / 2
            svg.append(f'<text x="{mid_x:.2f}" y="{row_y-14}" font-size="15" font-weight="700" fill="{COLOR_TITLE}" text-anchor="middle">{r["name"]}</text>')

        label_x = min(label_x, width - 260)
        svg.append(f'<text x="{label_x:.2f}" y="{row_y+5}" font-size="14" fill="{COLOR_SUBTITLE}" text-anchor="start">{r["label"]}</text>')

        row_y += ROW_HEIGHT

    svg.append("</svg>")
    return "\n".join(svg)


def export_png(svg_content, out_path, scale=PNG_SCALE):
    try:
        import resvg_py
    except ImportError:
        raise SystemExit(
            "生成PNG需要先安装 resvg-py：\n"
            "     python3 -m pip install resvg-py"
        )
    png_bytes = resvg_py.svg_to_bytes(
        svg_string=svg_content,
        zoom=scale,
        shape_rendering="geometric_precision",  # 线条/圆点用最高精度渲染，不做速度优化
        text_rendering="optimize_legibility",   # 文字优先清晰可读
    )
    with open(out_path, "wb") as f:
        f.write(bytes(png_bytes))


def main():
    rows = [compute_row(t) for t in TRADES]
    svg_content = build_svg(rows)

    if OUTPUT_FORMAT == "svg":
        out_path = f"{OUTPUT_FILE_BASE}.svg"
        with open(out_path, "w", encoding="utf-8") as f:
            f.write(svg_content)
        print(f"已生成: {out_path}")
    elif OUTPUT_FORMAT == "png":
        out_path = f"{OUTPUT_FILE_BASE}.png"
        export_png(svg_content, out_path)
        print(f"已生成: {out_path}")
    else:
        raise SystemExit(f"不支持的 OUTPUT_FORMAT: {OUTPUT_FORMAT!r}，请填 \"svg\" 或 \"png\"")


if __name__ == "__main__":
    main()
