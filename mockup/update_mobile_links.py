import os

files = [
    "d:/Project C/Yolobittest/mockup/canh_bao_khan_cap.mobile.html",
    "d:/Project C/Yolobittest/mockup/nhan_dien_khuon_mat.mobile.html",
    "d:/Project C/Yolobittest/mockup/dieu_khien_giong_noi.mobile.html"
]

def replace_tab(content, label, url):
    # This is a bit tricky since the class can be "tab-item" or "tab-item active"
    # We will search for <span>label</span> and go back to find the closest <div class="tab-item...">
    lines = content.split('\n')
    for i, line in enumerate(lines):
        if f"<span>{label}</span>" in line:
            # Look backwards for tab-item
            for j in range(i, i-5, -1):
                if 'class="tab-item' in lines[j] and 'onclick' not in lines[j]:
                    lines[j] = lines[j].replace('class="tab-item"', f'class="tab-item" onclick="window.location.href=\'{url}\'"')
                    lines[j] = lines[j].replace('class="tab-item active"', f'class="tab-item active" onclick="window.location.href=\'{url}\'"')
                    break
    return '\n'.join(lines)

for file in files:
    with open(file, 'r', encoding='utf-8') as f:
        content = f.read()

    content = replace_tab(content, "Tổng quan", "01 dashboard_tong_quan.html")
    content = replace_tab(content, "Khuôn mặt", "nhan_dien_khuon_mat.mobile.html")
    content = replace_tab(content, "Giọng nói", "dieu_khien_giong_noi.mobile.html")
    content = replace_tab(content, "Cảnh báo", "canh_bao_khan_cap.mobile.html")

    with open(file, 'w', encoding='utf-8') as f:
        f.write(content)

print("Updated links in all 3 mobile mockups.")
