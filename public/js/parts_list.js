// js/parts_list.js - 处理备件列表页面的逻辑

// --- 配置信息 ---
// 警告：API Token不应硬编码在前端，生产环境请务必采用更安全的方式管理。
const API_TOKEN = 'uskHcvUjPPwwLCVROw2N4qm'; // 使用用户提供的API Token
const PARTS_DATASHEET_ID = 'dstmlgTgra7TzChZ6X'; // 更正后的备件数据表ID

// 备件表中的字段名，与HTML表头对应，并用于从API结果中提取数据
const PART_FIELDS = {
    name: 'Part_name',            // 备件名称
    description: 'Part_description', // 备件描述
    number: 'Part_number',          // 备件编号
    quantity: 'Part_quantity',      // 数量
    location: 'Part_location',      // 位置
    department: 'Part_department'   // 部门
};

let currentPartsData = []; // 用于存储当前加载的所有备件数据，方便编辑时查找

// 当整个HTML文档加载完成并且DOM树构建完毕后执行回调函数
document.addEventListener('DOMContentLoaded', function() {
    // 获取表格的tbody元素和加载提示元素
    const partsTableBody = document.getElementById('partsTableBody');
    const loadingMessage = document.getElementById('loadingMessage');

    // 编辑模态框及其内部元素
    const editModal = document.getElementById('editPartModal');
    const closeEditModalBtn = document.getElementById('closeEditModalBtn');
    const cancelEditBtn = document.getElementById('cancelEditBtn');
    const editPartForm = document.getElementById('editPartForm');
    
    // 编辑表单的输入字段
    const editRecordIdInput = document.getElementById('editRecordId');
    const editPartNameInput = document.getElementById('editPartName');
    const editPartDescriptionInput = document.getElementById('editPartDescription');
    const editPartNumberInput = document.getElementById('editPartNumber');
    const editPartLocationInput = document.getElementById('editPartLocation');
    const editPartDepartmentInput = document.getElementById('editPartDepartment');

    // --- 出库模态框及其内部元素 ---
    const outboundModal = document.getElementById('outboundPartModal');
    const closeOutboundModalBtn = document.getElementById('closeOutboundModalBtn');
    const cancelOutboundBtn = document.getElementById('cancelOutboundBtn');
    const outboundPartForm = document.getElementById('outboundPartForm');
    const outboundRecordIdInput = document.getElementById('outboundRecordId');
    const outboundPartNameDisplay = document.getElementById('outboundPartNameDisplay');
    const outboundCurrentQuantityDisplay = document.getElementById('outboundCurrentQuantityDisplay');
    const outboundQuantityInput = document.getElementById('outboundQuantity');

    // --- 入库模态框及其内部元素 ---
    const inboundModal = document.getElementById('inboundPartModal');
    const closeInboundModalBtn = document.getElementById('closeInboundModalBtn');
    const cancelInboundBtn = document.getElementById('cancelInboundBtn');
    const inboundPartForm = document.getElementById('inboundPartForm');
    const inboundRecordIdInput = document.getElementById('inboundRecordId');
    const inboundPartNameDisplay = document.getElementById('inboundPartNameDisplay');
    const inboundQuantityInput = document.getElementById('inboundQuantity');

    // --- 新增备件模态框及其内部元素 ---
    const addPartModal = document.getElementById('addPartModal');
    const closeAddModalBtn = document.getElementById('closeAddModalBtn');
    const cancelAddBtn = document.getElementById('cancelAddBtn');
    const addPartForm = document.getElementById('addPartForm');
    const addNewPartButton = document.getElementById('addNewPartButton'); // 新增备件按钮

    // 新增表单的输入字段 (根据addPartModal的HTML结构获取)
    const addPartNameInput = document.getElementById('addPartName');
    const addPartDescriptionInput = document.getElementById('addPartDescription');
    const addPartNumberInput = document.getElementById('addPartNumber');
    const addPartQuantityInput = document.getElementById('addPartQuantity');
    const addPartLocationInput = document.getElementById('addPartLocation');
    const addPartDepartmentInput = document.getElementById('addPartDepartment');

    // --- 搜索功能相关元素 ---
    const searchInput = document.getElementById('searchInput');
    const searchButton = document.getElementById('searchButton');

    // 调用函数加载并显示备件数据
    loadAndDisplayParts();

    // --- \"新增备件\" 按钮事件 --- 
    if (addNewPartButton) {
        addNewPartButton.addEventListener('click', function() {
            openAddPartModal();
        });
    }

    // --- 搜索按钮事件 --- 
    if (searchButton && searchInput) {
        searchButton.addEventListener('click', function() {
            const searchTerm = searchInput.value.trim(); // 获取搜索词并去除前后空格
            loadAndDisplayParts(searchTerm); // 调用加载函数并传入搜索词
        });
        // 可选：用户在搜索框中按回车键也触发搜索
        searchInput.addEventListener('keypress', function(event) {
            if (event.key === 'Enter') {
                searchButton.click(); // 触发搜索按钮的点击事件
            }
        });
    }

    // --- 函数：加载并显示备件数据 ---
    async function loadAndDisplayParts(searchTerm = '') {
        if (!partsTableBody || !loadingMessage) { // 确保关键DOM元素存在
            console.error('表格或加载提示DOM元素未找到!');
            return;
        }

        loadingMessage.style.display = 'block'; // 显示加载提示
        partsTableBody.innerHTML = ''; // 清空表格现有内容
        // currentPartsData = []; // 不在此处清空，仅在成功获取数据后更新

        // 构建API请求URL，获取所有备件记录
        // 使用用户指定的 viewId 和 fieldKey=name 参数
        // 将 pageSize 恢复到用户确认可行的 1500
        const apiUrl = `https://api.vika.cn/fusion/v1/datasheets/${PARTS_DATASHEET_ID}/records?viewId=viwFnt41r3C4K&fieldKey=name&pageSize=1000`; 

        try {
            // 发送异步GET请求到维格表API
            const response = await fetch(apiUrl, {
                method: 'GET',
                headers: { 
                    'Authorization': `Bearer ${API_TOKEN}`,
                    'Content-Type': 'application/json'
                }
            });

            // 检查HTTP响应状态码
            if (!response.ok) {
                const errorStatus = response.status;
                const errorStatusText = response.statusText;
                let errorResponseData = null;
                try {
                    errorResponseData = await response.json(); // 尝试解析JSON响应体
                } catch (e) {
                    try {
                        errorResponseData = await response.text(); // 如果不是JSON，尝试解析为文本
                    } catch (e2) {
                        errorResponseData = "无法解析响应体";
                    }
                }
                console.error('获取备件列表API请求错误详情:', {
                    status: errorStatus,
                    statusText: errorStatusText,
                    headers: Object.fromEntries(response.headers.entries()), // 打印响应头
                    body: errorResponseData
                });
                const errorMessage = errorResponseData?.message || (typeof errorResponseData === 'string' ? errorResponseData : `请求失败，状态码：${errorStatus}`);
                loadingMessage.textContent = `加载备件数据失败: ${errorMessage}，请重试。`;
                return;
            }

            // 解析API返回的JSON数据
            const responseData = await response.json();

            // 检查API调用是否业务成功
            if (responseData.success && responseData.data && responseData.data.records) {
                currentPartsData = responseData.data.records; // 存储从API获取的完整数据
                let recordsToDisplay = currentPartsData; // 默认显示所有记录

                // 如果存在搜索词，则进行客户端过滤
                if (searchTerm) {
                    const lowerSearchTerm = searchTerm.toLowerCase(); // 将搜索词转为小写以进行不区分大小写的比较
                    recordsToDisplay = currentPartsData.filter(record => {
                        const fields = record.fields;
                        // 检查名称、描述、编号、位置字段是否包含搜索词
                        const nameMatch = fields[PART_FIELDS.name] && fields[PART_FIELDS.name].toLowerCase().includes(lowerSearchTerm);
                        const descriptionMatch = fields[PART_FIELDS.description] && fields[PART_FIELDS.description].toLowerCase().includes(lowerSearchTerm);
                        const numberMatch = fields[PART_FIELDS.number] && fields[PART_FIELDS.number].toLowerCase().includes(lowerSearchTerm);
                        const locationMatch = fields[PART_FIELDS.location] && fields[PART_FIELDS.location].toLowerCase().includes(lowerSearchTerm);
                        
                        return nameMatch || descriptionMatch || numberMatch || locationMatch; // 任一字段匹配即可
                    });
                }

                if (recordsToDisplay.length === 0) {
                    // 如果没有记录（或没有搜索结果），显示提示信息
                    if (searchTerm) {
                        loadingMessage.textContent = `没有找到与 \"${searchTerm}\" 相关的备件。`;
                    } else {
                        loadingMessage.textContent = '沒有找到备件数据。';
                    }
                    loadingMessage.style.display = 'block';
                } else {
                    // 遍历记录并填充表格
                    recordsToDisplay.forEach(record => {
                        const row = partsTableBody.insertRow(); // 插入一个新行
                        // 按照PART_FIELDS中定义的顺序和字段名提取数据并创建单元格
                        row.insertCell().textContent = record.fields[PART_FIELDS.name] || '-'; // 备件名称
                        row.insertCell().textContent = record.fields[PART_FIELDS.description] || '-'; // 备件描述
                        row.insertCell().textContent = record.fields[PART_FIELDS.number] || '-'; // 备件编号
                        row.insertCell().textContent = record.fields[PART_FIELDS.quantity] || '0'; // 数量，默认为0
                        row.insertCell().textContent = record.fields[PART_FIELDS.location] || '-'; // 位置
                        row.insertCell().textContent = record.fields[PART_FIELDS.department] || '-'; // 部门
                        
                        // 创建操作单元格
                        const actionsCell = row.insertCell();
                        actionsCell.innerHTML = `
                            <button class=\"action-btn edit-btn\" data-record-id=\"${record.recordId}\">编辑</button>
                            <button class=\"action-btn outbound-btn\" data-record-id=\"${record.recordId}\">出库</button>
                            <button class=\"action-btn inbound-btn\" data-record-id=\"${record.recordId}\">入库</button>
                        `; // 添加操作按钮，并带上记录ID以便后续操作
                        // TODO: 为这些按钮添加事件监听器
                    });
                    loadingMessage.style.display = 'none'; // 数据加载完成，隐藏加载提示
                }
            } else {
                // API返回 success: false 或数据格式不正确
                console.error('维格表API业务错误或数据格式不正确:', responseData.code, responseData.message);
                loadingMessage.textContent = `加载备件数据失败: ${responseData.message || '维格表返回数据格式错误'}，请重试。`;
            }

        } catch (error) {
            // 捕获网络错误或其他异常
            console.error('加载备件列表执行异常:', error);
            loadingMessage.textContent = '加载备件数据时发生网络错误，请检查连接并重试。';
        }
    }

    // --- 编辑功能相关 --- 

    // 事件委托：处理表格中操作按钮的点击
    partsTableBody.addEventListener('click', function(event) {
        const target = event.target;
        if (target.classList.contains('edit-btn')) {
            const recordId = target.dataset.recordId;
            const recordToEdit = currentPartsData.find(r => r.recordId === recordId);
            if (recordToEdit) {
                openEditModal(recordToEdit);
            }
        } else if (target.classList.contains('outbound-btn')) { // 处理出库按钮点击
            const recordId = target.dataset.recordId;
            const recordToOutbound = currentPartsData.find(r => r.recordId === recordId);
            if (recordToOutbound) {
                openOutboundModal(recordToOutbound);
            }
        } else if (target.classList.contains('inbound-btn')) { // 处理入库按钮点击
            const recordId = target.dataset.recordId;
            const recordToInbound = currentPartsData.find(r => r.recordId === recordId);
            if (recordToInbound) {
                openInboundModal(recordToInbound);
            }
        }
    });

    // 打开编辑模态框并填充数据
    function openEditModal(record) {
        if (!record || !record.fields) {
            console.error('无法编辑：记录数据不完整。', record);
            alert('无法加载此备件的编辑信息。');
            return;
        }
        editRecordIdInput.value = record.recordId; // 设置隐藏的记录ID
        editPartNameInput.value = record.fields[PART_FIELDS.name] || '';
        editPartDescriptionInput.value = record.fields[PART_FIELDS.description] || '';
        editPartNumberInput.value = record.fields[PART_FIELDS.number] || '';
        editPartLocationInput.value = record.fields[PART_FIELDS.location] || '';
        editPartDepartmentInput.value = record.fields[PART_FIELDS.department] || '';
        
        editModal.style.display = 'block'; // 显示模态框
    }

    // 关闭编辑模态框的函数
    function closeEditModal() {
        if (editModal) {
            editModal.style.display = 'none'; // 隐藏模态框
        }
    }

    // 为模态框的关闭按钮 \"×\" 添加事件监听
    if (closeEditModalBtn) {
        closeEditModalBtn.addEventListener('click', closeEditModal);
    }

    // 为模态框的 \"取消\" 按钮添加事件监听
    if (cancelEditBtn) {
        cancelEditBtn.addEventListener('click', closeEditModal);
    }

    // 点击模态框外部区域关闭模态框 (可选功能)
    window.addEventListener('click', function(event) {
        if (event.target === editModal) { 
            closeEditModal();
        }
        if (event.target === outboundModal) {
            closeOutboundModal();
        }
        if (event.target === inboundModal) {
            closeInboundModal();
        }
        if (event.target === addPartModal) {
            closeAddPartModal();
        }
    });

    // 处理编辑表单的提交
    if (editPartForm) {
        editPartForm.addEventListener('submit', async function(event) {
            event.preventDefault(); // 阻止默认的表单提交
            const submitButton = editPartForm.querySelector('button[type=\"submit\"]'); // 获取提交按钮
            const originalButtonText = submitButton.textContent; // 保存原始按钮文字

            submitButton.disabled = true; // 禁用按钮
            submitButton.textContent = '保存中...'; // 更改按钮文字为处理中状态

            const recordIdToUpdate = editRecordIdInput.value;
            const updatedFields = {
                [PART_FIELDS.name]: editPartNameInput.value.trim(),
                [PART_FIELDS.description]: editPartDescriptionInput.value.trim(),
                [PART_FIELDS.number]: editPartNumberInput.value.trim(),
                [PART_FIELDS.location]: editPartLocationInput.value.trim(),
                [PART_FIELDS.department]: editPartDepartmentInput.value.trim()
            };

            // 构建PATCH请求的数据体
            const requestBody = {
                records: [
                    {
                        recordId: recordIdToUpdate,
                        fields: updatedFields
                    }
                ],
                fieldKey: "name" // 根据API示例，PATCH时也需要此参数
            };

            const patchApiUrl = `https://api.vika.cn/fusion/v1/datasheets/${PARTS_DATASHEET_ID}/records`;

            try {
                const response = await fetch(patchApiUrl, {
                    method: 'PATCH',
                    headers: {
                        'Authorization': `Bearer ${API_TOKEN}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(requestBody)
                });

                const responseData = await response.json(); // 尝试解析所有响应，无论成功与否

                if (response.ok && responseData.success) {
                    alert('备件信息更新成功！');
                    closeEditModal();
                    loadAndDisplayParts(); // 重新加载列表以显示更新
                } else {
                    console.error('更新备件API错误:', responseData);
                    alert(`更新失败: ${responseData.message || '发生未知错误'}`);
                }
            } catch (error) {
                console.error('更新备件执行异常:', error);
                alert('更新过程中发生网络错误，请重试。');
            } finally {
                submitButton.disabled = false; // 无论成功或失败，都恢复按钮状态
                submitButton.textContent = originalButtonText; // 恢复原始按钮文字
            }
        });
    }

    // --- 出库功能相关 --- 

    // 打开出库模态框并填充数据
    function openOutboundModal(record) {
        if (!record || !record.fields) {
            console.error('无法出库：记录数据不完整。', record);
            alert('无法加载此备件的出库信息。');
            return;
        }
        outboundRecordIdInput.value = record.recordId; // 设置隐藏的记录ID
        outboundPartNameDisplay.textContent = record.fields[PART_FIELDS.name] || '未知备件';
        outboundCurrentQuantityDisplay.textContent = record.fields[PART_FIELDS.quantity] || '0';
        outboundQuantityInput.value = ''; // 清空上次输入
        outboundQuantityInput.max = record.fields[PART_FIELDS.quantity] || '0'; // 设置最大出库量为当前库存
        outboundModal.style.display = 'block'; // 显示模态框
    }

    // 关闭出库模态框的函数
    function closeOutboundModal() {
        if (outboundModal) {
            outboundModal.style.display = 'none'; // 隐藏模态框
        }
    }

    // 为出库模态框的关闭按钮 \"×\" 添加事件监听
    if (closeOutboundModalBtn) {
        closeOutboundModalBtn.addEventListener('click', closeOutboundModal);
    }

    // 为出库模态框的 \"取消\" 按钮添加事件监听
    if (cancelOutboundBtn) {
        cancelOutboundBtn.addEventListener('click', closeOutboundModal);
    }

    // 点击模态框外部区域关闭出库模态框
    window.addEventListener('click', function(event) {
        if (event.target === outboundModal) {
            closeOutboundModal();
        }
    });

    // 处理出库表单的提交
    if (outboundPartForm) {
        outboundPartForm.addEventListener('submit', async function(event) {
            event.preventDefault(); // 阻止默认的表单提交
            const submitButton = outboundPartForm.querySelector('button[type=\"submit\"]');
            const originalButtonText = submitButton.textContent;

            submitButton.disabled = true;
            submitButton.textContent = '出库中...';

            const recordIdToUpdate = outboundRecordIdInput.value;
            const quantityToOutbound = parseInt(outboundQuantityInput.value, 10);
            const currentQuantity = parseInt(outboundCurrentQuantityDisplay.textContent, 10);

            if (isNaN(quantityToOutbound) || quantityToOutbound <= 0) {
                alert('请输入有效的出库数量！');
                return;
            }

            if (quantityToOutbound > currentQuantity) {
                alert('出库数量不能大于当前库存！');
                return;
            }

            const newQuantity = currentQuantity - quantityToOutbound;

            const updatedFields = {
                [PART_FIELDS.quantity]: newQuantity // 只更新数量字段
            };

            const requestBody = {
                records: [
                    {
                        recordId: recordIdToUpdate,
                        fields: updatedFields
                    }
                ],
                fieldKey: "name"
            };

            const patchApiUrl = `https://api.vika.cn/fusion/v1/datasheets/${PARTS_DATASHEET_ID}/records`;

            try {
                const response = await fetch(patchApiUrl, {
                    method: 'PATCH',
                    headers: {
                        'Authorization': `Bearer ${API_TOKEN}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(requestBody)
                });

                const responseData = await response.json();

                if (response.ok && responseData.success) {
                    alert('备件出库成功！');
                    closeOutboundModal();
                    loadAndDisplayParts(); // 重新加载列表
                } else {
                    console.error('出库API错误:', responseData);
                    alert(`出库失败: ${responseData.message || '发生未知错误'}`);
                }
            } catch (error) {
                console.error('出库执行异常:', error);
                alert('出库过程中发生网络错误，请重试。');
            } finally {
                submitButton.disabled = false;
                submitButton.textContent = originalButtonText;
            }
        });
    }

    // --- 入库功能相关 --- 

    // 打开入库模态框并填充数据
    function openInboundModal(record) {
        if (!record || !record.fields) {
            console.error('无法入库：记录数据不完整。', record);
            alert('无法加载此备件的入库信息。');
            return;
        }
        inboundRecordIdInput.value = record.recordId; // 设置隐藏的记录ID
        inboundPartNameDisplay.textContent = record.fields[PART_FIELDS.name] || '未知备件';
        inboundQuantityInput.value = ''; // 清空上次输入
        inboundModal.style.display = 'block'; // 显示模态框
    }

    // 关闭入库模态框的函数
    function closeInboundModal() {
        if (inboundModal) {
            inboundModal.style.display = 'none'; // 隐藏模态框
        }
    }

    // 为入库模态框的关闭按钮 \"×\" 添加事件监听
    if (closeInboundModalBtn) {
        closeInboundModalBtn.addEventListener('click', closeInboundModal);
    }

    // 为入库模态框的 \"取消\" 按钮添加事件监听
    if (cancelInboundBtn) {
        cancelInboundBtn.addEventListener('click', closeInboundModal);
    }

    // 点击模态框外部区域关闭入库模态框
    window.addEventListener('click', function(event) {
        if (event.target === inboundModal) { // 如果点击的是模态框背景
            closeInboundModal();
        }
        if (event.target === editModal) { 
            closeEditModal();
        }
        if (event.target === outboundModal) {
            closeOutboundModal();
        }
        if (event.target === addPartModal) {
            closeAddPartModal();
        }
    });

    // 处理入库表单的提交
    if (inboundPartForm) {
        inboundPartForm.addEventListener('submit', async function(event) {
            event.preventDefault(); // 阻止默认的表单提交
            const submitButton = inboundPartForm.querySelector('button[type=\"submit\"]');
            const originalButtonText = submitButton.textContent;

            submitButton.disabled = true;
            submitButton.textContent = '入库中...';

            const recordIdToUpdate = inboundRecordIdInput.value;
            
            // 获取当前数量需要从 currentPartsData 中查找，因为入库模态框不直接显示当前数量
            const partRecord = currentPartsData.find(r => r.recordId === recordIdToUpdate);
            if (!partRecord || !partRecord.fields.hasOwnProperty(PART_FIELDS.quantity)) {
                alert('找不到备件的当前数量信息，无法入库。');
                return;
            }
            const currentQuantity = parseInt(partRecord.fields[PART_FIELDS.quantity], 10) || 0;

            const quantityToInbound = parseInt(inboundQuantityInput.value, 10);

            if (isNaN(quantityToInbound) || quantityToInbound <= 0) {
                alert('请输入有效的入库数量！');
                return;
            }

            const newQuantity = currentQuantity + quantityToInbound;

            const updatedFields = {
                [PART_FIELDS.quantity]: newQuantity // 只更新数量字段
            };

            const requestBody = {
                records: [
                    {
                        recordId: recordIdToUpdate,
                        fields: updatedFields
                    }
                ],
                fieldKey: "name"
            };

            const patchApiUrl = `https://api.vika.cn/fusion/v1/datasheets/${PARTS_DATASHEET_ID}/records`;

            try {
                const response = await fetch(patchApiUrl, {
                    method: 'PATCH',
                    headers: {
                        'Authorization': `Bearer ${API_TOKEN}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(requestBody)
                });

                const responseData = await response.json();

                if (response.ok && responseData.success) {
                    alert('备件入库成功！');
                    closeInboundModal();
                    loadAndDisplayParts(); // 重新加载列表
                } else {
                    console.error('入库API错误:', responseData);
                    alert(`入库失败: ${responseData.message || '发生未知错误'}`);
                }
            } catch (error) {
                console.error('入库执行异常:', error);
                alert('入库过程中发生网络错误，请重试。');
            } finally {
                submitButton.disabled = false;
                submitButton.textContent = originalButtonText;
            }
        });
    }

    // --- 新增备件功能相关 --- 

    // 打开新增备件模态框
    function openAddPartModal() {
        if (addPartForm) addPartForm.reset(); // 打开时清空表单内容
        if (addPartModal) addPartModal.style.display = 'block';
    }

    // 关闭新增备件模态框
    function closeAddPartModal() {
        if (addPartModal) addPartModal.style.display = 'none';
    }

    // 为新增模态框的关闭按钮 \"×\" 添加事件监听
    if (closeAddModalBtn) {
        closeAddModalBtn.addEventListener('click', closeAddPartModal);
    }

    // 为新增模态框的 \"取消\" 按钮添加事件监听
    if (cancelAddBtn) {
        cancelAddBtn.addEventListener('click', closeAddPartModal);
    }

    // 处理新增备件表单的提交
    if (addPartForm) {
        addPartForm.addEventListener('submit', async function(event) {
            event.preventDefault(); // 阻止表单默认提交行为
            const submitButton = addPartForm.querySelector('button[type=\"submit\"]');
            const originalButtonText = submitButton.textContent;

            submitButton.disabled = true;
            submitButton.textContent = '新增中...';

            // 从表单获取数据
            const newPartFields = {
                [PART_FIELDS.name]: addPartNameInput.value.trim(),
                [PART_FIELDS.description]: addPartDescriptionInput.value.trim(),
                [PART_FIELDS.number]: addPartNumberInput.value.trim(),
                [PART_FIELDS.quantity]: parseInt(addPartQuantityInput.value, 10) || 0, // 确保是数字，默认为0
                [PART_FIELDS.location]: addPartLocationInput.value.trim(),
                [PART_FIELDS.department]: addPartDepartmentInput.value.trim()
            };

            // 基本校验：备件名称不能为空
            if (!newPartFields[PART_FIELDS.name]) {
                alert('备件名称不能为空！');
                return;
            }
            // 校验：数量不能为负数 (HTML的min=\"0\"已处理，但JS校验更保险)
            if (newPartFields[PART_FIELDS.quantity] < 0) {
                alert('初始数量不能为负数！');
                return;
            }

            // 构建POST请求的数据体
            const requestBody = {
                records: [
                    {
                        fields: newPartFields
                    }
                ],
                fieldKey: "name" // 与获取和更新时保持一致
            };

            const postApiUrl = `https://api.vika.cn/fusion/v1/datasheets/${PARTS_DATASHEET_ID}/records`;

            try {
                const response = await fetch(postApiUrl, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${API_TOKEN}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(requestBody)
                });

                const responseData = await response.json();

                if (response.ok && responseData.success) {
                    alert('新备件添加成功！');
                    closeAddPartModal();
                    loadAndDisplayParts(); // 重新加载列表以显示新备件
                } else {
                    console.error('新增备件API错误:', responseData);
                    alert(`新增失败: ${responseData.message || '发生未知错误'}`);
                }
            } catch (error) {
                console.error('新增备件执行异常:', error);
                alert('新增过程中发生网络错误，请重试。');
            } finally {
                submitButton.disabled = false;
                submitButton.textContent = originalButtonText;
            }
        });
    }

    // TODO: 实现搜索功能
    // const searchButton = document.getElementById('searchButton');
    // const searchInput = document.getElementById('searchInput');
    // if(searchButton && searchInput){
    //     searchButton.addEventListener('click', function(){
    //         const searchTerm = searchInput.value.trim();
    //         // 调用 loadAndDisplayParts 并传入搜索条件
    //     });
    // }
}); 