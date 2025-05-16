// js/login.js - 处理登录页面的逻辑

// --- 配置信息 ---
// 警告：直接在前端代码中嵌入API Token存在安全风险，生产环境请勿如此操作。
// 建议将API调用和Token管理放在后端，或使用更安全的API密钥管理方式。
const API_TOKEN = 'uskHcvUjPPwwLCVROw2N4qm'; // 您的维格表API Token
const DATASHEET_ID = 'dstq31ZTKk1MJ4185l'; // 您的用户数据表ID
const FIELD_USERNAME = 'Name'; // 存储用户名的字段名
const FIELD_PASSWORD = 'Password'; // 存储密码的字段名 (警告：应存储哈希后的密码)

// 当整个HTML文档加载完成并且DOM树构建完毕后执行回调函数
document.addEventListener('DOMContentLoaded', function() {
    // 获取ID为 loginForm 的表单元素
    const loginForm = document.getElementById('loginForm');

    // 如果找到了登录表单
    if (loginForm) {
        // 为表单的提交事件添加一个异步监听器
        loginForm.addEventListener('submit', async function(event) {
            event.preventDefault(); // 阻止表单的默认提交行为（防止页面刷新）

            // 获取ID为 username 的输入框元素的值，并去除首尾空格
            const usernameInput = document.getElementById('username').value.trim();
            // 获取ID为 password 的输入框元素的值，并去除首尾空格
            const passwordInput = document.getElementById('password').value.trim();

            // 检查用户名和密码是否为空
            if (usernameInput === '' || passwordInput === '') {
                alert('用户名和密码不能为空！'); // 如果为空，弹出提示
                return; // 结束后续操作
            }

            // --- 核心登录逻辑：调用维格表API ---
            // 构建API请求URL，用于根据用户名查询用户记录
            // filterByFormula 使用维格表公式进行筛选，这里是精确匹配用户名字段
            const apiUrl = `https://api.vika.cn/fusion/v1/datasheets/${DATASHEET_ID}/records?filterByFormula=({${FIELD_USERNAME}}%3D%22${encodeURIComponent(usernameInput)}%22)`;

            try {
                // 发送异步GET请求到维格表API
                const response = await fetch(apiUrl, {
                    method: 'GET',
                    headers: {
                        'Authorization': `Bearer ${API_TOKEN}`,
                        'Content-Type': 'application/json'
                    }
                });

                // 检查HTTP响应状态码是否表示成功 (2xx范围)
                if (!response.ok) {
                    // 如果响应不成功，尝试解析错误信息
                    const errorData = await response.json().catch(() => null); // 尝试解析JSON，失败则为null
                    const errorMessage = errorData?.message || `请求失败，状态码：${response.status}`;
                    console.error('维格表API请求错误:', response.status, errorData);
                    alert(`登录请求处理失败: ${errorMessage}`);
                    return;
                }

                // 解析API返回的JSON数据
                const responseData = await response.json();

                // 检查API调用是否业务成功
                if (responseData.success) {
                    const records = responseData.data.records; // 获取记录列表
                    // 检查是否找到了用户记录
                    if (records && records.length > 0) {
                        const userRecord = records[0]; // 获取第一条匹配的记录 (假设用户名是唯一的)
                        const storedPassword = userRecord.fields[FIELD_PASSWORD]; // 获取存储的密码

                        // **重要安全警告：此处为明文密码比较，仅用于演示。**
                        // **生产环境中，数据库应存储密码的哈希值，比较时也应比较哈希值。**
                        if (passwordInput === storedPassword) {
                            // alert('登录成功！欢迎回来, ' + usernameInput + '!'); // 登录成功提示
                            // 实际项目中，登录成功后通常会跳转到主页面或仪表盘
                            window.location.href = 'pages/parts_dashboard.html'; // 跳转到备件管理主页
                        } else {
                            alert('登录失败！密码错误。');
                        }
                    } else {
                        alert('登录失败！用户不存在。');
                    }
                } else {
                    // 如果API返回 success: false，显示维格表返回的错误信息
                    console.error('维格表API业务错误:', responseData.code, responseData.message);
                    alert(`登录失败: ${responseData.message || '维格表处理错误'}`);
                }

            } catch (error) {
                // 捕获网络错误或其他在fetch过程中发生的异常
                console.error('登录逻辑执行异常:', error);
                alert('登录过程中发生错误，请检查网络或联系管理员。');
            }
        });
    }
}); 