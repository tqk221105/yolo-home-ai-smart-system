document.addEventListener('DOMContentLoaded', () => {
    // Inject Theme Toggle Button if it doesn't exist
    const topbar = document.querySelector('.topbar');
    if (topbar && !document.querySelector('.theme-toggle-btn')) {
        const titleElement = document.querySelector('.page-title');
        const statusElement = topbar.querySelector('div:not(.page-title)');
        
        // Wrap status element and create toggle button
        const rightContainer = document.createElement('div');
        rightContainer.className = 'topbar-right';
        
        const toggleBtn = document.createElement('button');
        toggleBtn.className = 'theme-toggle-btn';
        toggleBtn.id = 'theme-toggle';
        toggleBtn.innerHTML = `
            <svg class="sun-icon" viewBox="0 0 24 24"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>
            <span class="btn-text">Giao diện sáng</span>
        `;
        
        if (statusElement) {
            statusElement.parentNode.insertBefore(rightContainer, statusElement);
            rightContainer.appendChild(statusElement);
            rightContainer.appendChild(toggleBtn);
        } else {
            topbar.appendChild(rightContainer);
            rightContainer.appendChild(toggleBtn);
        }

        // Initialize Theme Functionality
        initTheme();
    }
});

function initTheme() {
    const toggleBtn = document.getElementById('theme-toggle');
    const sunIcon = '<svg class="sun-icon" viewBox="0 0 24 24"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>';
    const moonIcon = '<svg class="moon-icon" viewBox="0 0 24 24"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>';
    const btnText = toggleBtn.querySelector('.btn-text');

    // Check Local Storage
    const currentTheme = localStorage.getItem('yolo-theme') || 'light';
    
    if (currentTheme === 'dark') {
        document.body.classList.add('dark-mode');
        toggleBtn.innerHTML = `${moonIcon} <span class="btn-text">Giao diện tối</span>`;
    }

    toggleBtn.addEventListener('click', () => {
        document.body.classList.toggle('dark-mode');
        
        if (document.body.classList.contains('dark-mode')) {
            localStorage.setItem('yolo-theme', 'dark');
            toggleBtn.innerHTML = `${moonIcon} <span class="btn-text">Giao diện tối</span>`;
        } else {
            localStorage.setItem('yolo-theme', 'light');
            toggleBtn.innerHTML = `${sunIcon} <span class="btn-text">Giao diện sáng</span>`;
        } // rebind btnText if needed, but innerHTML replaces it
    });

    // Make sidebar links clickable to navigate between mockups easily
    const navItems = document.querySelectorAll('.nav-item');
    const pageMap = {
        'Dashboard': '01 dashboard_tong_quan.html',
        'Cửa & bảo mật': '02 cua_bao_mat.html',
        'Điều khiển': '03 dieu_khien_thu_cong.html',
        'Ngưỡng tự động': '04 cai_dat_nguong_tu_dong.html',
        'Quản lý mật mã': '06 quan_ly_mat_ma.html',
        'Cảnh báo': '05 canh_bao_thong_bao.html',
        'Lịch sử': '9 lich_su_thong_ke.html',
        'Quản lý khuôn mặt': '07 quan_ly_khuon_mat.html',
        'Cài đặt giọng nói': '08 cai_dat_giong_noi.html',
        'Cài đặt hệ thống': '10 cai_dat_he_thong.html'
    };

    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            const text = item.textContent.trim();
            if (pageMap[text]) {
                window.location.href = pageMap[text];
            }
        });
    });
}
