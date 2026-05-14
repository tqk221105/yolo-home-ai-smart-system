import os

directory = r"d:\Project C\Yolobittest\mockup"
html_files = [
    "01 dashboard_tong_quan.html",
    "02 cua_bao_mat.html",
    "03 dieu_khien_thu_cong.html",
    "04 cai_dat_nguong_tu_dong.html",
    "05 canh_bao_thong_bao.html",
    "06 quan_ly_mat_ma.html",
    "07 quan_ly_khuon_mat.html",
    "08 cai_dat_giong_noi.html",
    "10 cai_dat_he_thong.html",
    "9 lich_su_thong_ke.html"
]

injection = """<!DOCTYPE html>
<html lang="vi">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Yolo Home</title>
    <link rel="stylesheet" href="style.css">
    <script defer src="script.js"></script>
</head>
<body>
"""

for file_name in html_files:
    path = os.path.join(directory, file_name)
    if os.path.exists(path):
        with open(path, "r", encoding="utf-8") as f:
            content = f.read()
            
        if "style.css" not in content:
            # Let's wrap the content properly if it doesn't have <html>
            if "<html" not in content:
                new_content = injection + content + "\n</body>\n</html>"
            else:
                # If there's <head>, put it there
                new_content = content.replace("</head>", '    <link rel="stylesheet" href="style.css">\n    <script defer src="script.js"></script>\n</head>')
                
            with open(path, "w", encoding="utf-8") as f:
                f.write(new_content)
                print(f"Updated {file_name}")
        else:
            print(f"Skipped {file_name}")
